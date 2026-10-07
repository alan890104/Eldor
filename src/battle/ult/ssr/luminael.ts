// Luminael, the Morningstar: "Morningstar Revelation"
//
// What this cinematic is about: the winged horse gathers the daylight into a starry night, rears up and neighs, and the morning star on its forehead rises into a star-sun behind it; it flips the sky over (backlight),
// and with one stamp throws the morning star onto the opponent, twelve star-ray blades planted into a ring of holy seal, and daybreak begins from beneath the opponent's feet.
// Cast under Backlight ("Dawn"): a blue-white morning star, the frame flips to the left; in normal order ("Dusk"): a gold-and-rose evening star, the frame flips to the right.
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed)
//   windup
//     0.00  Nightfall: announcement, letterbox; the camera hard cuts to a low angle in front of the face (audience side 38°) and slowly pushes in. The sky is pressed into a starry night within 0.7 s, the holy city and the opponent turning into indigo silhouettes;
//           in the close-up the horse is not pressed into a silhouette, only tinted a pale indigo-white of moonlight, its face clean and clearly visible. The horse stops to look around and faces forward (act.focus),
//           the morning star on its forehead lights up (act.star, the part's own self-illumination; at 0.20 a small 0.18 s flash). A low night wind (luminael-night)
//     0.32  Eye glints: one small 0.16 s flash in each eye (no additive light sprite in front of the face stays on longer than 0.2 s)
//     0.72  Rear and neigh: cut to a low-angle full-body shot at audience side 52°, and only now is the whole horse pressed into a backlit silhouette; rearing up (rear), both wings spread and raised high (spread, flap −1),
//           head thrown back at 0.92 s (raise).
//           The camera retreats along the same line; the hind hooves kick up dust, and the neigh is loudest as the head reaches full tilt (luminael-neigh)
//     1.35  Morning star rises (signature shot): a solid morning star (an eight-pointed star core with heavy outline, twelve star-ray blades, a halo and radial rays behind) rises from the horizon behind the horse,
//           framing the rearing horse as a silhouette. Dolly zoom for 1.27 s: the camera pulls back further along the same line while the focal length lengthens, the horse's size unchanged and the star behind it looming ever larger.
//           A reflection of starlight spreads across the ground, a hymn chorus (luminael-choir)
//     2.25  Revelation: the star-ray blades extend all at once and the radial rays open; the horse makes one downstroke (flap −1 → 1), the wingtips sweeping out white feathers and light dust, and the hind hooves a ring of dust (luminael-wings)
//     2.62  A beat of silence: the star core shrinks and the star-ray blades draw inward
//     2.85  End
//   deliver
//     0.00  Backlight flip: the frame rolls 180° (Dawn to the left, Dusk to the right) while pushing in, the reversed inhale sound loudest as the flip reaches its end (luminael-flip)
//     0.42  Black sun: the whole frame inverts for 0.12 s
//     0.54  Back to upright, hard cut to a follow shot at audience side 76°; the horse's forehooves come down (rear 1 → 0), landing at 0.70: dust ring, cracks, shake (luminael-stomp).
//           At the same time the morning star leaves the sky and falls accelerating along an arc over the horse's head, the star-ray blades folding back into tail feathers, trailing a comet tail bright at the center (luminael-fall, loudest at the impact)
//     1.02  Target's view: cut to a low angle behind the opponent on the audience side looking up, the opponent near and the stomping horse far away, the morning star falling toward the camera trailing its tail, the camera slowly pushing in
//     1.36  The moment before impact (handed to the director)
//   impact: the morning star bursts into daybreak (a burst of radiating starlight, the horizon lights up, the silhouettes release, a warm light on the opponent); twelve star-ray blades shoot from the burst point and plant into the ground around the opponent,
//           a solid gold ring and light pillars emerge on the ground, with light specks and white feathers falling (luminael-dawn, luminael-bell). At 0.32 s the camera retreats back and up from the target's view and turns toward the audience side;
//           at 0.95 s the night eases back by half, and after another 0.5 s it is back in the wide shot
//   guarded (only "Dusk" can be blocked): the morning star shatters against the barrier, the star-ray blades scatter and plant in the ground, the starry sky goes dark star by star, and daybreak does not come
//   after: the horse folds its wings and returns to idle; the star-ray blades and gold ring sink into the ground; the night recedes and the light effects fade back, and the sky, lighting and arena effects are all restored
//
// How the night is done: the arena effects pause rewriting the atmosphere (fieldFx.hold), and sky / fog / lighting / toon ambient light are written each frame after the arena effects;
// the scene's cartoon materials are pressed into an indigo silhouette with the hit flash (lines still drawn), opaque custom materials are swapped for a silhouette material, and transparent light effects and self-illumination are temporarily hidden.
// The spirits' backlit silhouettes are done on the material (spirits do not take bloom): base color pressed to deep indigo (the opponent one step darker), rim light changed to the star color (Dawn blue, Dusk gold);
// the horse also has the model's act.back, a wider rim light of star color along the top edge of the silhouette; the eyes are only pressed by 30% and the iris's self-illumination is brightened, so where it is looking can be seen;
// the morning star on the forehead is not pressed, since it is the light source. The legacy model falls back to pressing to indigo with the hit flash (the opponent darker).

import * as THREE from 'three';
import { playOr, playSample, preloadSamples } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import bellUrl from '../../../audio/sfx/luminael-bell.mp3';
import choirUrl from '../../../audio/sfx/luminael-choir.mp3';
import dawnUrl from '../../../audio/sfx/luminael-dawn.mp3';
import fallUrl from '../../../audio/sfx/luminael-fall.mp3';
import flipUrl from '../../../audio/sfx/luminael-flip.mp3';
import neighUrl from '../../../audio/sfx/luminael-neigh.mp3';
import nightUrl from '../../../audio/sfx/luminael-night.mp3';
import stompUrl from '../../../audio/sfx/luminael-stomp.mp3';
import wingsUrl from '../../../audio/sfx/luminael-wings.mp3';
import type { Creature } from '../../../render/creature.ts';
import { crackTex, starTex, streakTex } from '../../../render/fxtex.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { SPIRIT_RIG } from '../../../render/lab/toonKit.ts';
import { type SpiritMaterial, sceneMaterial } from '../../../render/spiritToon.ts';
import { runeCircleTex } from '../../../render/textures.ts';
import { LIGHT } from '../../../render/toon.ts';
import { ease } from '../../../render/tween.ts';
import type { FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [nightUrl, neighUrl, choirUrl, wingsUrl, flipUrl, stompUrl, fallUrl, dawnUrl, bellUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const UP = new THREE.Vector3(0, 1, 0);
const V = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
const _c = new THREE.Color();
const _c2 = new THREE.Color();

/** Palette: Dusk is a gold-and-rose evening star, Dawn a blue-white morning star; the sky color also leans purple or blue to match */
interface Pal {
  core: number;
  star: number;
  blade: number;
  halo: number;
  seal: number;
  dawnMid: number;
  dawnBot: number;
  sky: [number, number, number];
}
const DUSK: Pal = { core: 0xfff2d2, star: 0xffbf4f, blade: 0xffa83c, halo: 0xff7aa0, seal: 0xffc860, dawnMid: 0xffa070, dawnBot: 0xffe0b0, sky: [0x07061c, 0x1d1442, 0x46285c] };
const DAWN: Pal = { core: 0xf0f8ff, star: 0x9cc8ff, blade: 0x7cb4ff, halo: 0x6f8cff, seal: 0xbfe0ff, dawnMid: 0xa8c8ff, dawnBot: 0xfff0d0, sky: [0x040a22, 0x0e1c4a, 0x283f78] };

/** Silhouette: the scene is pressed to deep indigo with the hit flash; the legacy model's spirits also go through the flash (SIL, SIL_OLD); tinted warm at daybreak */
const SIL = new THREE.Color(0x252a5c);
const SIL_ARENA = new THREE.Color(0x161a40);
const SIL_BASIC = new THREE.Color(0x0c1030);
const SIL_WARM = new THREE.Color(0x5c3848);
const SIL_OLD = 0.82;
/** The legacy model's opponent: one step darker than the horse */
const SIL_OLD_FOE = new THREE.Color(0x171a44);
/**
 * The new model's backlit silhouette (done on the material, not relying on bloom): base color pressed to deep indigo (the opponent one step darker), rim light changed to the star color, strengthened,
 * its direction turning with the morning star; the eyes are only pressed a little and the iris's self-illumination brightened; the horse's morning star on the forehead (a self-illuminated part) is not pressed, since it is the light source.
 */
const SPIRIT_SIL = [
  { alb: new THREE.Color(0x1a1d4a), rim: 0.6, rimGain: 0.55 },
  { alb: new THREE.Color(0x0e1034), rim: 1.3, rimGain: 0.4 },
] as const;
const SIL_WARM_ALB = new THREE.Color(0x3a2436);
/** In the face close-up the horse is not pressed into a silhouette, only tinted a pale indigo-white of moonlight: as night falls, the face is clean and clearly visible */
const MOON_ALB = new THREE.Color(0xb4bcf0);
/** Lighting of the night (the sky follows the palette separately) */
const NIGHT = {
  fog: new THREE.Color(0x10143a),
  sunI: 0.15,
  hemiI: 0.3,
  sunCol: new THREE.Color(0x8494ff),
  hemiCol: new THREE.Color(0x4a58a8),
  hemiGround: new THREE.Color(0x0c0e24),
  ambient: new THREE.Color(0.12, 0.12, 0.24),
  shadow: new THREE.Color(0.2, 0.18, 0.36),
};

// ───────────────────────── State ─────────────────────────

type FlashU = { uFlash: { value: THREE.Color }; uFlashAmt: { value: number } };
interface Day {
  sky: THREE.Color[];
  stars: number;
  fog: THREE.Color;
  sunI: number;
  hemiI: number;
  sunCol: THREE.Color;
  hemiCol: THREE.Color;
  hemiGround: THREE.Color;
  ambient: THREE.Color;
  rim: THREE.Color;
  shadow: THREE.Color;
  motes: number[];
}
interface World {
  day: Day;
  /** The scene's cartoon materials: pressed into a silhouette with the hit flash */
  toon: FlashU[];
  /** Opaque custom materials (distant mountains, sea of clouds): swapped for the silhouette material when the night is deep enough */
  swapped: { o: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[];
  swappedOn: boolean;
  silMat: THREE.MeshBasicMaterial;
  /** Transparent, additive, point-like light effects: hidden at night */
  hidden: THREE.Object3D[];
  /** Self-illumination that does not take the tint (sun, window lights, halos): fades in and out with the night */
  glow: { o: THREE.Object3D; mat: THREE.MeshBasicMaterial; transparent: boolean; opacity: number }[];
  /** The arena effects' transparent light shells and particles (it sets itself back to visible every frame) */
  field: THREE.Object3D[];
  /** The silhouette settings of the two spirits (null on the legacy model, which goes through the hit flash) */
  spirits: (SpiritSil | null)[];
}

/** Each material's own uniforms in the spirit materials (toonKit's labToon) */
interface LabU {
  uRim: { value: number };
  uRimColor: { value: THREE.Color };
  uRimWorld: { value: THREE.Vector3 };
  uSpec: { value: number };
}
interface SilMat {
  m: SpiritMaterial;
  u: LabU;
  color: THREE.Color;
  emi: number;
  rim: number;
  spec: number;
  rimWorld: THREE.Vector3;
  /** eye: the eye parts (only pressed a little); light: the horse's glowing parts (not pressed) */
  eye: boolean;
  light: boolean;
}
interface SpiritSil {
  mats: SilMat[];
  /** Uniform for the rim light color (several materials may share one, so it is collected separately) */
  rimCols: { u: { value: THREE.Color }; base: THREE.Color }[];
  /** This spirit's rim light direction (world coordinates, updated every frame) */
  dir: THREE.Vector3;
}

interface Star {
  root: THREE.Group;
  /** World coordinates (the script changes it, and the effects layer applies it to root every frame) */
  pos: THREE.Vector3;
  /** Direction of flight (the star-ray blades fold toward the opposite direction) */
  vel: THREE.Vector3;
  /** scale: overall size; ext: star-ray blade length; flare: radial rays; core: star core size; halo: halo; fold: star-ray blades folding back; glow: self-illumination */
  s: { scale: number; ext: number; flare: number; core: number; halo: number; fold: number; glow: number };
  kill(): void;
}

interface Trail {
  mesh: THREE.Group;
  set(head: number, tail: number, width: number, alpha: number): void;
  kill(): void;
}

interface SealBlade {
  g: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  qa: THREE.Quaternion;
  qb: THREE.Quaternion;
  k: number;
}
interface Seal {
  root: THREE.Group;
  blades: SealBlade[];
  /** ring: gold ring unfolding; sink: sinking into the ground; glow: self-illumination multiplier of the star-ray blades and gold ring (brightest just after they plant) */
  s: { sink: number; ring: number; glow: number };
  kill(): void;
}

interface Mem {
  /** "Dawn" = acts first under Backlight; "Dusk" = normal order, acts last */
  dawn: boolean;
  pal: Pal;
  night: number;
  boost: number;
  /** Silhouette depth of the two spirits, 0 to 1 */
  sil: number;
  /** Moonlight for the face close-up (at 1 the horse is tinted pale indigo-white instead of a silhouette; reset to zero when cutting to the full body) */
  moon: number;
  world?: World;
  star?: Star;
  trail?: Trail;
  seal?: Seal;
  geo?: Geo;
  layers: FxLayer[];
  /** A safety net at scene wrap-up: when the player leaves the battle midway, after does not run, so the global lighting and arena settings must be restored through this */
  unreg?: () => void;
}
const mem = (c: UltCtx): Mem => (c.mem.lum ??= { dawn: false, pal: DUSK, night: 0, boost: 0, sil: 0, moon: 0, layers: [] }) as Mem;

const hOf = (c: UltCtx, s: 0 | 1): number => c.sc.slots[s].creature?.worldHeight ?? 1.5;
/** The horse's action weights (only effective on the experimental model) */
const act = (c: UltCtx): Record<string, number> => c.sc.slots[c.side].creature?.act ?? {};
const low = (c: UltCtx): boolean => c.sc.stage.quality === 'low';

/** World position of an anchor; use fallback when the legacy model has no such anchor */
function anchorPos(c: UltCtx, name: string, fallback: () => THREE.Vector3): THREE.Vector3 {
  const cr = c.sc.slots[c.side].creature;
  const a = cr?.anchor(name);
  if (!cr || !a) return fallback();
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}

/** How far away to frame a region of height hgt and width wid completely (by the field-of-view multiplier fovScale and aspect ratio) */
function fitDist(c: UltCtx, hgt: number, wid: number, fovScale: number): number {
  const { sc } = c;
  const cam = sc.stage.camera;
  const halfTan = Math.tan(THREE.MathUtils.degToRad((cam.fov / sc.stage.fovScale) * fovScale * 0.5));
  return Math.max((hgt * 0.5) / halfTan, (wid * 0.5) / (halfTan * cam.aspect));
}

/** Take the camera at second at on the timeline, and for dur seconds fn places the camera directly every frame */
function camRig(c: UltCtx, tl: gsap.core.Timeline, at: number, dur: number, easeName: string, fn: (k: number, pos: THREE.Vector3, look: THREE.Vector3) => void): void {
  const r = c.sc.rig;
  const st = { k: 0 };
  let tok = -1;
  tl.call(() => {
    tok = r.claim();
    fn(0, r.pos, r.look);
  }, [], at);
  tl.to(st, { k: 1, duration: dur, ease: easeName, onUpdate: () => r.owns(tok) && fn(st.k, r.pos, r.look) }, at);
}

/** Read the mechanic state: whether it carries "Dawn" (under Backlight) */
function readPhase(c: UltCtx): boolean {
  const me = c.view.sides[c.side];
  return !!me.team[me.active]?.marks.some((k) => k.id === 'kit:lum_phase' && k.note !== '昏');
}

// ───────────────────────── Geometry and camera positions ─────────────────────────

/** When the dolly is pulled all the way back, the most the camera's horizontal distance from the horse can be, as a multiple of the starting distance */
const DOLLY = 2.0;
/** How far from the arena center the dolly camera can be at most (there is no ground built beyond the edge of the arena) */
const CAM_R = 15;
const _ray = new THREE.Raycaster();

/**
 * Starting from from and going outward along the horizontal direction dir, how far away the nearest arena object (steps, stone platform, pillars) is; measured again offset by side to the left and right and down 0.25, so things beside the camera and under its feet also count.
 * Only opaque, visible meshes are looked at (the sky dome does not count).
 */
function clearance(c: UltCtx, from: THREE.Vector3, dir: THREE.Vector3, side: number, far: number): number {
  const A = c.sc.arena;
  const lat = V(-dir.z, 0, dir.x);
  let best = far;
  for (const [off, dy] of [[0, 0], [side, 0], [-side, 0], [0, -0.25]]) {
    _ray.set(from.clone().addScaledVector(lat, off).add(V(0, dy, 0)), dir);
    _ray.far = far;
    for (const h of _ray.intersectObject(A.group, true)) {
      const mat = (h.object as THREE.Mesh).material as THREE.Material;
      if (!h.object.visible || mat === A.skyMat || Array.isArray(mat) || mat.transparent) continue;
      best = Math.min(best, h.distance);
      break;
    }
  }
  return best;
}

interface Geo {
  h: number;
  fwd: THREE.Vector3;
  /** The horse's neck while rearing (the dolly camera orbits around it) */
  N: THREE.Vector3;
  /** Horizontal direction of the dolly camera (audience side 52°), starting distance, distance when pulled all the way back, and height */
  dirH: THREE.Vector3;
  d0: number;
  d1: number;
  camY: number;
  /** Position of the morning star in the sky (exactly behind the horse's head and neck when the dolly reaches the end), and its position before rising */
  S: THREE.Vector3;
  Slow: THREE.Vector3;
  /** Size unit of the morning star (star core radius) */
  R: number;
  /** The arc along which the morning star falls */
  curve: THREE.CatmullRomCurve3;
}

function geoSpec(c: UltCtx): Geo {
  const { sc, cine, side } = c;
  const h = hOf(c, side);
  const fwd = cine.forward(side);
  const home = sc.slots[side].home.clone().setY(0);
  const N = home.clone().add(V(0, h * 0.92, 0)).addScaledVector(fwd, h * 0.05);
  const dirH = cine.orbitPos(side, V(), 52, 1, 0).setY(0).normalize();
  // The rearing horse (together with its raised wings) takes up about 60% of the frame height
  const d0 = fitDist(c, h * 1.75, h * 2.4, 1);
  // Distance when pulled all the way back: at most DOLLY times, and the camera does not go beyond CAM_R of the arena center (solve |N + dirH·d| = CAM_R)
  const b = N.x * dirH.x + N.z * dirH.z;
  const cc = N.x * N.x + N.z * N.z - CAM_R * CAM_R;
  const dMax = -b + Math.sqrt(Math.max(0, b * b - cc));
  const camY = Math.max(0.5, h * 0.2);
  // The camera keeps retreating: if there are arena objects on the retreat path (including one meter to either side), it stops in front of them
  const start = N.clone().addScaledVector(dirH, d0 * 0.5).setY(camY);
  const room = d0 * 0.5 + clearance(c, start, dirH, 1, d0 * DOLLY) - 1.2;
  const d1 = Math.max(d0 * 1.3, Math.min(d0 * DOLLY, dMax, room));
  const camEnd = N.clone().addScaledVector(dirH, d1).setY(camY);
  // The morning star is placed on the extension of the line "dolly end → base of the horse's neck": when pulled all the way back, the star's center is exactly behind the base of the neck, with the raised head overlapping the upper half of the ring of light
  const aim = N.clone().add(V(0, h * 0.02, 0));
  const S = aim.clone().addScaledVector(aim.clone().sub(camEnd).normalize(), h * 2.9);
  const Slow = S.clone().add(V(0, -h * 1.8, 0));
  const g: Geo = { h, fwd, N, dirH, d0, d1, camY, S, Slow, R: h * 0.4, curve: new THREE.CatmullRomCurve3([V(), V(0, 1, 0)]) };
  g.curve = flightCurve(c, g);
  return g;
}

/** Dolly camera: horizontal distance d, the camera close to the ground, looking at a point a little below the horse's neck */
function dollyCam(g: Geo, d: number, pos: THREE.Vector3, look: THREE.Vector3): void {
  pos.copy(g.N).addScaledVector(g.dirH, d).setY(g.camY);
  look.copy(g.N).add(V(0, -g.h * 0.1, 0));
}

/**
 * The arc along which the morning star falls: behind and above the horse's head → over the head → high in the air between the two → onto the opponent.
 * The start is not where the star in the sky was: after the flip and the black sun there is a hard cut, and the star is thrown from behind the horse's head, so that the follow camera can frame the horse and the star together.
 */
function flightCurve(c: UltCtx, g: Geo): THREE.CatmullRomCurve3 {
  const { sc, side, foe } = c;
  const h = g.h;
  const hf = hOf(c, foe);
  const home = sc.slots[side].home.clone().setY(0);
  const foeC = sc.center(foe).add(V(0, hf * 0.05, 0));
  const p0 = home.clone().add(V(0, h * 1.45, 0)).addScaledVector(g.fwd, -h * 0.45);
  const p1 = home.clone().add(V(0, h * 1.75, 0)).addScaledVector(g.fwd, h * 0.55);
  const p2 = home.clone().lerp(foeC.clone().setY(0), 0.62).add(V(0, h * 1.25 + hf * 0.35, 0));
  return new THREE.CatmullRomCurve3([p0, p1, p2, foeC], false, 'centripetal');
}

// ───────────────────────── Night and silhouettes ─────────────────────────

/** Record how daytime looks and classify the scene objects (on the first call) */
function scanWorld(c: UltCtx): World {
  const { sc } = c;
  const A = sc.arena;
  const u = A.skyMat.uniforms;
  const day: Day = {
    sky: [(u.top.value as THREE.Color).clone(), (u.mid.value as THREE.Color).clone(), (u.bot.value as THREE.Color).clone()],
    stars: u.uStars.value as number,
    fog: A.fog.color.clone(),
    sunI: A.sun.intensity,
    hemiI: A.hemi.intensity,
    sunCol: A.sun.color.clone(),
    hemiCol: A.hemi.color.clone(),
    hemiGround: A.hemi.groundColor.clone(),
    ambient: LIGHT.ambient.value.clone(),
    rim: LIGHT.rimColor.value.clone(),
    shadow: LIGHT.shadowTint.value.clone(),
    motes: A.palette.motes,
  };
  const toon = new Set<FlashU>();
  const swapped: World['swapped'] = [];
  const hidden: THREE.Object3D[] = [];
  const glow: World['glow'] = [];
  A.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!mat || Array.isArray(mat) || !o.visible || mat === A.skyMat) return;
    const isFx = (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite || (o as THREE.Line).isLine;
    if (isFx || mat.transparent || mat.blending !== THREE.NormalBlending) {
      hidden.push(o);
      return;
    }
    const un = (mat as unknown as { uniforms?: Partial<FlashU> }).uniforms;
    if (un?.uFlash && un.uFlashAmt) {
      toon.add(un as FlashU);
      return;
    }
    // Materials that take the scene lights dim along with the sun and skylight
    if (mat instanceof THREE.MeshLambertMaterial || mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial || (mat as THREE.MeshToonMaterial).isMeshToonMaterial) return;
    if (mat instanceof THREE.MeshBasicMaterial && !mat.toneMapped) {
      glow.push({ o, mat, transparent: mat.transparent, opacity: mat.opacity });
      return;
    }
    swapped.push({ o: mesh, mat });
  });
  const field: THREE.Object3D[] = [];
  (sc.fieldFx as unknown as { group?: THREE.Group }).group?.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
    if ((o as THREE.Points).isPoints || (mat && !Array.isArray(mat) && (mat.transparent || mat.blending !== THREE.NormalBlending))) field.push(o);
  });
  A.palette.motes = [0x000000];
  const spirits = sc.slots.map((sl, i) => (sl.creature ? scanSpirit(sl.creature, i === c.side) : null));
  return { day, toon: [...toon], swapped, swappedOn: false, silMat: new THREE.MeshBasicMaterial({ color: SIL_BASIC, fog: true }), hidden, glow, field, spirits };
}

/**
 * Record a spirit's materials (only the new model has labToon uniforms; the legacy model returns null).
 * Eye parts: the small meshes hanging directly under the parent group of the eye anchor. The horse's self-illuminated parts (the morning star on the forehead, the irises) are not darkened.
 */
function scanSpirit(cr: Creature, self: boolean): SpiritSil | null {
  const mats = cr.mats as SpiritMaterial[];
  if (!mats.length || !mats.every((x) => (x.userData as { u?: LabU }).u)) return null;
  const h = cr.worldHeight;
  const eyeMats = new Set<THREE.Material>();
  const eyeParents = new Set<THREE.Object3D>();
  const ws = new THREE.Vector3();
  cr.root.updateMatrixWorld(true);
  for (const e of cr.eyes) {
    if (!e.parent) continue;
    eyeParents.add(e.parent);
    for (const o of e.parent.children) {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) continue;
      mesh.geometry.computeBoundingSphere();
      const r = (mesh.geometry.boundingSphere?.radius ?? 1) * mesh.getWorldScale(ws).x;
      if (r < h * 0.06) eyeMats.add(mesh.material);
    }
  }
  // Materials also used outside the eye group (the fur of the brow ridge and eyelids) do not count as eyes
  cr.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh.parent && eyeParents.has(mesh.parent))) return;
    for (const x of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) eyeMats.delete(x);
  });
  const rimCols = new Map<{ value: THREE.Color }, THREE.Color>();
  const out: SilMat[] = mats.map((m) => {
    const u = (m.userData as { u: LabU }).u;
    if (!rimCols.has(u.uRimColor)) rimCols.set(u.uRimColor, u.uRimColor.value.clone());
    const eye = eyeMats.has(m);
    const light = self && !eye && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0;
    return { m, u, color: m.color.clone(), emi: m.emissiveIntensity, rim: u.uRim.value, spec: u.uSpec.value, rimWorld: u.uRimWorld.value, eye, light };
  });
  return { mats: out, rimCols: [...rimCols].map(([u, base]) => ({ u, base })), dir: new THREE.Vector3(0, 1, 0) };
}

/**
 * Write the backlit silhouette of one new-model spirit every frame. a is depth 0 to 1, b is daybreak, moon is the moonlight of the face close-up (base color tinted pale indigo-white).
 * The rim light formula (toonKit): uRimColor × LIGHT's rim ratio × (0.45 + 0.55 × base color) × edge × uRim, then the hit flash is laid over it;
 * uRimColor is back-solved here so that the color at the edge is exactly the star color, leaving the strength to uRim.
 */
function writeSpirit(c: UltCtx, slot: 0 | 1, sp: SpiritSil, a: number, b: number, moon: number): void {
  const { sc } = c;
  const m = mem(c);
  const cfg = SPIRIT_SIL[slot === c.side ? 0 : 1];
  const cam = sc.stage.camera.position;
  const ctr = sc.center(slot);
  // Direction: from above, slightly away from the camera (a face squarely toward the camera takes no rim light); once the morning star has risen past this spirit's waist, it also shifts toward the morning star's side
  // (only the part perpendicular to the line of sight is taken: when the star is directly behind there is no shift, so the rim light does not fall under the belly)
  const away = ctr.clone().sub(cam).normalize();
  sp.dir.copy(UP).addScaledVector(away, 0.45);
  if (m.star && m.star.pos.y > ctr.y) {
    const toStar = m.star.pos.clone().sub(ctr);
    const len = Math.max(toStar.length(), 1e-3);
    toStar.addScaledVector(away, -toStar.dot(away));
    const k = Math.min(1, (toStar.length() / len) * 1.5);
    if (k > 0.05 && toStar.y > -0.2 * toStar.length()) sp.dir.addScaledVector(toStar.normalize(), 0.7 * k);
  }
  sp.dir.normalize();
  // Rim light color: the star color, divided by LIGHT's rim ratio
  const R = SPIRIT_RIG;
  const t = R.tint.value;
  const lr = LIGHT.rimColor.value;
  const rr = R.rimRef.value;
  _c.set(m.pal.star);
  _c.r = (_c.r * cfg.rimGain) / Math.max(1e-3, (1 - t + (t * lr.r) / Math.max(rr.r, 1e-3)) * 0.46);
  _c.g = (_c.g * cfg.rimGain) / Math.max(1e-3, (1 - t + (t * lr.g) / Math.max(rr.g, 1e-3)) * 0.46);
  _c.b = (_c.b * cfg.rimGain) / Math.max(1e-3, (1 - t + (t * lr.b) / Math.max(rr.b, 1e-3)) * 0.46);
  for (const rc of sp.rimCols) rc.u.value.copy(rc.base).lerp(_c, a);
  _c2.copy(cfg.alb).lerp(MOON_ALB, moon).lerp(SIL_WARM_ALB, b);
  // The base color is a linear value: press it by perceived brightness (half of a looks half as dark)
  const ac = 1 - Math.pow(1 - Math.min(1, a), 2.2);
  for (const s of sp.mats) {
    s.u.uRimWorld.value = a > 0 ? sp.dir : s.rimWorld;
    if (s.light) continue;
    if (s.eye) {
      // The eyes are only pressed by 30%, and the iris's self-illumination is brightened: where it is looking can be seen
      s.m.color.copy(s.color).lerp(_c2, a * 0.3);
      s.m.emissiveIntensity = s.emi * (1 + a * 1.6);
      continue;
    }
    s.m.color.copy(s.color).lerp(_c2, ac * 0.97);
    s.u.uSpec.value = s.spec * (1 - a * 0.85);
    s.u.uRim.value = s.rim + (cfg.rim - s.rim) * a;
  }
}

/** Put a spirit's materials back as they were */
function restoreSpirit(sp: SpiritSil): void {
  for (const rc of sp.rimCols) rc.u.value.copy(rc.base);
  for (const s of sp.mats) {
    s.u.uRimWorld.value = s.rimWorld;
    s.m.color.copy(s.color);
    s.m.emissiveIntensity = s.emi;
    s.u.uSpec.value = s.spec;
    s.u.uRim.value = s.rim;
  }
}

/**
 * Every frame (effects layer, running after the spirits, arena and arena effects update): write the night, press the scene and the two spirits into silhouettes, and hide the light effects.
 * night 0 to 1 is the depth of the night, boost is daybreak (the horizon lights up, silhouettes tint warm), and sil is the depth of the spirit silhouettes.
 */
function writeNight(c: UltCtx): void {
  const { sc } = c;
  const m = mem(c);
  const w = m.world;
  if (!w || sc.disposed) return;
  const A = sc.arena;
  const u = A.skyMat.uniforms;
  const d = w.day;
  const P = m.pal;
  const k = m.night;
  const b = m.boost;
  (u.top.value as THREE.Color).lerpColors(d.sky[0], _c.set(P.sky[0]), k);
  (u.mid.value as THREE.Color).lerpColors(d.sky[1], _c.set(P.sky[1]), k).lerp(_c.set(P.halo).multiplyScalar(0.55), b * 0.3);
  (u.bot.value as THREE.Color).lerpColors(d.sky[2], _c.set(P.sky[2]), k).lerp(_c.set(P.dawnBot), b * 0.8);
  u.uStars.value = k > 0.35 ? 1 : d.stars;
  A.fog.color.lerpColors(d.fog, NIGHT.fog, k);
  A.sun.intensity = THREE.MathUtils.lerp(d.sunI, NIGHT.sunI, k);
  A.sun.color.lerpColors(d.sunCol, NIGHT.sunCol, k);
  A.hemi.intensity = THREE.MathUtils.lerp(d.hemiI, NIGHT.hemiI, k);
  A.hemi.color.lerpColors(d.hemiCol, NIGHT.hemiCol, k);
  A.hemi.groundColor.lerpColors(d.hemiGround, NIGHT.hemiGround, k);
  LIGHT.ambient.value.lerpColors(d.ambient, NIGHT.ambient, k);
  // Backlight: the rim light changes to the star color, setting a line of light along the silhouette's edge
  LIGHT.rimColor.value.lerpColors(d.rim, _c.set(P.star).multiplyScalar(2.6), k);
  LIGHT.shadowTint.value.lerpColors(d.shadow, NIGHT.shadow, k);
  const amt = k * 0.84 * (1 - b * 0.4);
  _c2.copy(SIL_ARENA).lerp(SIL_WARM, b * 0.6);
  for (const t of w.toon) {
    t.uFlashAmt.value = amt;
    t.uFlash.value.copy(_c2);
  }
  // Custom materials are swapped for the silhouette material once the night is deep enough, and swapped back when the night drops below a quarter
  const on = k > 0.25;
  if (on !== w.swappedOn) {
    w.swappedOn = on;
    for (const s of w.swapped) s.o.material = on ? w.silMat : s.mat;
  }
  w.silMat.color.copy(SIL_BASIC).lerp(SIL_WARM, b * 0.5);
  const hide = k > 0.3;
  for (const o of w.hidden) o.visible = !hide;
  if (hide) for (const o of w.field) o.visible = false;
  // Self-illumination: fully on below night 0.2, fully off above 0.6
  const f = THREE.MathUtils.clamp((0.6 - k) / 0.4, 0, 1);
  for (const g of w.glow) {
    g.o.visible = f > 0.01;
    g.mat.transparent = f < 1 ? true : g.transparent;
    g.mat.opacity = f < 1 ? g.opacity * f : g.opacity;
  }
  // The two spirits' silhouettes: the new model does the backlit silhouette on the material (the white hit flash still lays over it as usual); the legacy model presses to indigo with the flash, and when the white flash is brighter than the silhouette the white flash wins
  for (const slot of [0, 1] as const) {
    const cr = sc.slots[slot].creature;
    if (!cr) continue;
    const sp = w.spirits[slot];
    const self = slot === c.side;
    const moon = self ? m.moon : 0;
    const a = m.sil;
    if (sp) {
      writeSpirit(c, slot, sp, a, b, moon);
      // The horse's own backlight (the model's act.back): a line of star-colored rim light along the top edge of the silhouette
      if (self) {
        const A = act(c);
        if ('back' in A) {
          A.back = a * (1 - moon * 0.4);
          A.backDawn = m.dawn ? 1 : 0;
        }
      }
      continue;
    }
    if (a <= 0) continue;
    const amt = a * (self ? SIL_OLD * (1 - moon * 0.5) : 0.88);
    _c2.copy(self ? SIL : SIL_OLD_FOE).lerp(SIL_WARM, b);
    if (cr.flash > amt) cr.applyFlash(cr.flashColor, cr.flash);
    else cr.applyFlash(_c2, amt);
  }
}

/**
 * Put all the global state that was changed back (can be called repeatedly): sky, fog, lighting, toon lighting LIGHT, silhouettes, hidden objects, arena effects, action weights, VFX objects.
 * Called at the end of after; when the player leaves the battle midway it is called as a safety net by sc.addCleanup.
 */
function restoreWorld(c: UltCtx): void {
  const { sc } = c;
  const m = mem(c);
  for (const l of m.layers) l.kill();
  m.layers = [];
  m.star?.kill();
  m.star = undefined;
  m.trail?.kill();
  m.trail = undefined;
  m.seal?.kill();
  m.seal = undefined;
  m.night = 0;
  m.boost = 0;
  m.sil = 0;
  m.moon = 0;
  const A = act(c);
  for (const k of ['focus', 'rear', 'raise', 'spread', 'flap', 'beat', 'star', 'back', 'backDawn']) if (k in A) A[k] = 0;
  sc.slots[c.foe].creature?.setGlowMul(1);
  const w = m.world;
  m.world = undefined;
  if (!w) return;
  const d = w.day;
  LIGHT.ambient.value.copy(d.ambient);
  LIGHT.rimColor.value.copy(d.rim);
  LIGHT.shadowTint.value.copy(d.shadow);
  for (const t of w.toon) t.uFlashAmt.value = 0;
  for (const s of w.swapped) s.o.material = s.mat;
  for (const o of w.hidden) o.visible = true;
  for (const g of w.glow) {
    g.o.visible = true;
    g.mat.transparent = g.transparent;
    g.mat.opacity = g.opacity;
  }
  w.silMat.dispose();
  for (const sp of w.spirits) if (sp) restoreSpirit(sp);
  for (const s of sc.slots) s.creature?.applyFlash();
  if (sc.disposed) return;
  const Ar = sc.arena;
  const u = Ar.skyMat.uniforms;
  (u.top.value as THREE.Color).copy(d.sky[0]);
  (u.mid.value as THREE.Color).copy(d.sky[1]);
  (u.bot.value as THREE.Color).copy(d.sky[2]);
  u.uStars.value = d.stars;
  Ar.fog.color.copy(d.fog);
  Ar.sun.intensity = d.sunI;
  Ar.sun.color.copy(d.sunCol);
  Ar.hemi.intensity = d.hemiI;
  Ar.hemi.color.copy(d.hemiCol);
  Ar.hemi.groundColor.copy(d.hemiGround);
  Ar.palette.motes = d.motes;
  sc.fieldFx.hold = false;
  sc.fieldFx.holdFx = false;
}

// ───────────────────────── Morning star ─────────────────────────

/** Solid parts: scene cartoon material, heavy outline (the ultimate's solid VFX), with self-illumination deciding the color */
function solid(geo: THREE.BufferGeometry, col: THREE.ColorRepresentation, em: THREE.ColorRepresentation, emAmt: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, sceneMaterial(col, { emissive: em, emissiveAmt: emAmt, rim: 0 }));
  m.layers.enable(INK_LAYER);
  m.userData.inkScene = true;
  m.userData.inkHeavy = true;
  return m;
}

/** The gem of the eight-pointed star: 16 points on the outer edge (long ray, short ray, notch taking turns), one raised vertex on each of the front and back faces, with fold lines between the facets */
function gemStarGeo(long: number, short: number, inner: number, thick: number): THREE.BufferGeometry {
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 8;
    const r = i % 2 ? inner : i % 4 === 0 ? long : short;
    ring.push(V(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const f = V(0, 0, thick);
  const b = V(0, 0, -thick);
  const pos: number[] = [];
  for (let i = 0; i < 16; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % 16];
    pos.push(f.x, f.y, f.z, p.x, p.y, p.z, q.x, q.y, q.z);
    pos.push(b.x, b.y, b.z, q.x, q.y, q.z, p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Star-ray blade: a diamond-shaped blade growing from the origin toward +y, with a ridge down the middle (length 1, width w) */
function bladeGeo(w: number, thick: number): THREE.BufferGeometry {
  const base = V(0, 0, 0);
  const tip = V(0, 1, 0);
  const r = V(w, 0.28, 0);
  const l = V(-w, 0.28, 0);
  const f = V(0, 0.28, thick);
  const bk = V(0, 0.28, -thick);
  const tris = [
    [base, r, f], [r, tip, f], [tip, l, f], [l, base, f],
    [base, bk, r], [r, bk, tip], [tip, bk, l], [l, bk, base],
  ];
  const pos: number[] = [];
  for (const t of tris) for (const p of t) pos.push(p.x, p.y, p.z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Halo and radial rays (additive, facing the camera): a ring of soft light outside the star core, a halo shifting from the star color to the outer-ring color, radial rays that open with flare */
function haloMaterial(P: Pal): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(P.star) },
      uCore: { value: new THREE.Color(P.core) },
      uRose: { value: new THREE.Color(P.halo).multiplyScalar(0.85) },
      uT: { value: 0 },
      uA: { value: 1 },
      uFlare: { value: 0 },
      uCoreR: { value: 0.16 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uCore; uniform vec3 uRose; uniform float uT; uniform float uA; uniform float uFlare; uniform float uCoreR;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float edge = exp(-max(r - uCoreR, 0.0) * 14.0);
        float halo = exp(-r * 3.2);
        // Radiating light: eight long rays, sixteen medium rays and thirty thin rays, rotating slowly
        float ray = pow(max(0.0, sin(a * 4.0 + uT * 0.1)), 18.0);
        ray += 0.6 * pow(max(0.0, sin(a * 8.0 - uT * 0.3 + 0.4)), 30.0);
        ray += 0.35 * pow(max(0.0, cos(a * 15.0 + uT * 0.5)), 60.0);
        ray *= exp(-r * (3.6 - uFlare * 1.9)) * smoothstep(uCoreR * 0.6, uCoreR * 1.8, r) * (0.3 + uFlare);
        float fade = smoothstep(1.0, 0.7, r);
        vec3 tone = mix(uCol, uRose, smoothstep(0.1, 0.65, r));
        vec3 col = uCore * edge * 0.7 + tone * (halo * 0.65 + ray * 1.1);
        gl_FragColor = vec4(col * fade * uA, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

const BLADES = 12;
/** Length of the i-th star-ray blade (as a multiple of the star core radius): alternating long and short */
const bladeLen = (i: number): number => (i % 2 ? 1.45 : 2.4);

type EmU = { uniforms: { uEmissiveAmt: { value: number } } };

/** Morning star: a solid eight-pointed star core (gold outside, white inside), twelve star-ray blades, and a halo behind; the whole set always faces the camera (keeping the world's up direction, so the star rolls along when the frame rolls) */
function makeStar(c: UltCtx, R: number, at: THREE.Vector3): Star {
  const { sc } = c;
  const P = mem(c).pal;
  const root = new THREE.Group();
  // The base color carries a touch of the star color: the toon ambient light at night is very dark, and a white base color plus self-illumination would smear into cream
  const tint = (col: number, k: number) => new THREE.Color(0xffffff).lerp(new THREE.Color(col), k);
  const core = solid(gemStarGeo(1, 0.58, 0.3, 0.28), tint(P.star, 0.5), P.star, 0.8);
  const inner = solid(gemStarGeo(0.5, 0.3, 0.16, 0.2), 0xffffff, P.core, 1.35);
  inner.position.z = 0.16;
  const coreG = new THREE.Group();
  coreG.add(core, inner);
  root.add(coreG);
  const bGeo = bladeGeo(0.16, 0.07);
  const bMat = sceneMaterial(tint(P.blade, 0.55), { emissive: P.blade, emissiveAmt: 0.6, rim: 0 });
  const pivots: THREE.Group[] = [];
  const blades: THREE.Mesh[] = [];
  const base: number[] = [];
  for (let i = 0; i < BLADES; i++) {
    const p = new THREE.Group();
    const b = new THREE.Mesh(bGeo, bMat);
    b.layers.enable(INK_LAYER);
    b.userData.inkScene = true;
    b.userData.inkHeavy = true;
    b.position.y = 0.92;
    p.add(b);
    root.add(p);
    pivots.push(p);
    blades.push(b);
    base.push(Math.PI / 2 + (i * Math.PI * 2) / BLADES);
  }
  const hMat = haloMaterial(P);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), hMat);
  halo.position.z = -0.4;
  halo.renderOrder = 2;
  root.add(halo);
  root.position.copy(at);
  root.visible = false;
  const s = { scale: 0.7, ext: 0.35, flare: 0, core: 1, halo: 1, fold: 0, glow: 0.6 };
  const vel = V();
  const pos = at.clone();
  const cam = sc.stage.camera;
  const inv = new THREE.Quaternion();
  const lv = V();
  const cMat = core.material as unknown as EmU;
  const iMat = inner.material as unknown as EmU;
  const bm = bMat as unknown as EmU;
  let spin = 0;
  const layer = sc.vfx.layer(root, (dt, t) => {
    root.position.copy(pos);
    root.lookAt(cam.position);
    root.scale.setScalar(Math.max(1e-3, R * s.scale));
    coreG.scale.setScalar(Math.max(0.05, s.core));
    coreG.rotation.z = Math.sin(t * 0.7) * 0.06;
    cMat.uniforms.uEmissiveAmt.value = 0.8 * s.glow;
    iMat.uniforms.uEmissiveAmt.value = 1.35 * s.glow;
    bm.uniforms.uEmissiveAmt.value = 0.6 * s.glow;
    spin += dt * 0.12 * (1 - s.fold);
    // The star-ray blades fold toward the opposite of the direction of flight (in the star's plane), the folded blades stretching into tail feathers
    let back = -Math.PI / 2;
    if (s.fold > 0 && vel.lengthSq() > 1e-8) {
      inv.copy(root.quaternion).invert();
      lv.copy(vel).applyQuaternion(inv);
      back = Math.atan2(-lv.y, -lv.x);
    }
    for (let i = 0; i < BLADES; i++) {
      const a0 = base[i] + spin;
      const dd = Math.atan2(Math.sin(a0 - back), Math.cos(a0 - back));
      const a = back + dd * (1 - 0.92 * s.fold);
      pivots[i].rotation.z = a - Math.PI / 2;
      const L = bladeLen(i) * s.ext * (1 + s.fold * 0.25 * (0.5 + 0.5 * Math.cos(dd)));
      blades[i].scale.set(1 - s.fold * 0.3, Math.max(0.02, L), 1);
    }
    hMat.uniforms.uT.value = t;
    hMat.uniforms.uFlare.value = s.flare;
    hMat.uniforms.uA.value = s.halo;
    hMat.uniforms.uCoreR.value = 0.16 * s.core;
  });
  registerInkRoot(root);
  return { root, pos, vel, s, kill: () => layer.kill() };
}

/** Comet tail: a camera-facing band of light along the arc of the falling star (bright at the center, thinner and fainter toward the tail end) */
function makeTrail(c: UltCtx, curve: THREE.Curve<THREE.Vector3>, P: Pal): Trail {
  const { sc } = c;
  const M = 48;
  const cam = sc.stage.camera;
  const g = new THREE.Group();
  const ribbons: { pos: THREE.BufferAttribute; mat: THREE.ShaderMaterial; w: number }[] = [];
  const mk = (w: number, col: number, hi: number, gain: number) => {
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array((M + 1) * 6), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    const at = new Float32Array((M + 1) * 2);
    const as = new Float32Array((M + 1) * 2);
    const idx: number[] = [];
    for (let j = 0; j <= M; j++) {
      at[j * 2] = at[j * 2 + 1] = j / M;
      as[j * 2] = -1;
      as[j * 2 + 1] = 1;
      if (j < M) idx.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2);
    }
    geo.setAttribute('position', pos);
    geo.setAttribute('aT', new THREE.BufferAttribute(at, 1));
    geo.setAttribute('aS', new THREE.BufferAttribute(as, 1));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(col) }, uHi: { value: new THREE.Color(hi) }, uA: { value: 0 }, uGain: { value: gain } },
      vertexShader: /* glsl */ `attribute float aT; attribute float aS; varying float vT; varying float vS;
        void main(){ vT = aT; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uCol; uniform vec3 uHi; uniform float uA; uniform float uGain; varying float vT; varying float vS;
        void main(){
          float x = max(1.0 - abs(vS), 0.0);
          float body = pow(x, 2.0);
          float hot = pow(x, 5.0);
          float along = smoothstep(0.0, 0.35, vT);
          float a = (body * 0.7 + hot) * along * uA * uGain;
          gl_FragColor = vec4(mix(uCol, uHi, hot * vT) * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    g.add(mesh);
    ribbons.push({ pos, mat, w });
  };
  mk(1, P.star, P.core, 2);
  if (!low(c)) mk(2.6, P.halo, P.star, 0.4);
  g.visible = false;
  const p = V();
  const t = V();
  const side = V();
  const t0 = curve.getTangentAt(0);
  const p0 = curve.getPointAt(0);
  const len = curve.getLength();
  // u < 0: extends back along the tangent at the start (the direction the star was thrown from), so the comet tail already has length the moment it is thrown
  const at = (u: number) => {
    if (u >= 0) {
      curve.getPointAt(Math.min(1, u), p);
      curve.getTangentAt(Math.min(1, u), t);
    } else {
      p.copy(p0).addScaledVector(t0, u * len);
      t.copy(t0);
    }
  };
  const layer = sc.vfx.layer(g, () => {});
  return {
    mesh: g,
    set(head, tail, width, alpha) {
      g.visible = alpha > 0.001 && head > tail;
      if (!g.visible) return;
      for (const r of ribbons) {
        const arr = r.pos.array as Float32Array;
        for (let j = 0; j <= M; j++) {
          const k = j / M;
          at(tail + (head - tail) * k);
          side.copy(cam.position).sub(p).cross(t).normalize();
          const w = width * r.w * Math.pow(k, 0.4);
          arr[j * 6] = p.x - side.x * w;
          arr[j * 6 + 1] = p.y - side.y * w;
          arr[j * 6 + 2] = p.z - side.z * w;
          arr[j * 6 + 3] = p.x + side.x * w;
          arr[j * 6 + 4] = p.y + side.y * w;
          arr[j * 6 + 5] = p.z + side.z * w;
        }
        r.pos.needsUpdate = true;
        r.mat.uniforms.uA.value = alpha;
      }
    },
    kill: () => layer.kill(),
  };
}

/** Reflection of the starlight on the ground: a thin band of light spread from directly below the star toward the camera (additive, flat on the ground), slowly lighting up and then fading */
function groundBand(c: UltCtx, from: THREE.Vector3, to: THREE.Vector3, width: number, col: number, dur: number): void {
  const len = from.distanceTo(to);
  const mat = new THREE.MeshBasicMaterial({ map: streakTex(), color: new THREE.Color(col).multiplyScalar(0.9), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), mat);
  const dir = to.clone().sub(from).setY(0).normalize();
  m.rotation.set(-Math.PI / 2, 0, Math.atan2(-dir.z, dir.x));
  m.position.copy(from).lerp(to, 0.5).setY(0.05);
  void c.sc.vfx.spawn(m, dur, (k) => {
    mat.opacity = (k < 0.35 ? k / 0.35 : Math.pow(1 - (k - 0.35) / 0.65, 1.5)) * 0.6;
  });
}

/** Daybreak's light pillar: a thin, tall beam bright at the center (additive), first shooting up and then thinning and fading; it does not smear into a white sheet even when the camera is close to the opponent */
function dawnBeam(c: UltCtx, pos: THREE.Vector3, radius: number, height: number, col: number, dur: number): void {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.6, height, 24, 1, true);
  geo.translate(0, height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(col).multiplyScalar(1.3) }, uA: { value: 0 }, uH: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uA; uniform float uH; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float body = pow(max(f, 0.0), 2.5);
        float hot = pow(max(f, 0.0), 10.0);
        float rise = smoothstep(uH, uH - 0.12, vUv.y);
        float a = body * pow(max(1.0 - vUv.y, 0.0), 1.2) * rise * uA;
        gl_FragColor = vec4((uCol * body + vec3(0.9) * hot) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(pos);
  void c.sc.vfx.spawn(m, dur, (k) => {
    mat.uniforms.uH.value = Math.min(1.1, k * 6);
    mat.uniforms.uA.value = k < 0.1 ? k / 0.1 : Math.pow(1 - (k - 0.1) / 0.9, 1.5);
    const w = k < 0.1 ? 0.5 + k * 5 : 1 - (k - 0.1) * 0.7;
    m.scale.set(w, 1, w);
  });
}

/** Impact starburst: camera-facing radial rays that open all at once and then fade (effects clock, which still opens during hit-stop) */
function starBurst(c: UltCtx, pos: THREE.Vector3, r0: number, r1: number, dur: number): void {
  const { sc } = c;
  const mat = haloMaterial(mem(c).pal);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.position.copy(pos);
  m.renderOrder = 7;
  let t = 0;
  void sc.vfx.spawn(m, dur, (k, dt) => {
    t += dt;
    m.quaternion.copy(sc.stage.camera.quaternion);
    m.scale.setScalar(r0 + (r1 - r0) * ease.outCubic(k));
    mat.uniforms.uT.value = t * 3;
    mat.uniforms.uFlare.value = 1.6 - k;
    mat.uniforms.uCoreR.value = 0.12 * (1 - k);
    mat.uniforms.uA.value = Math.pow(1 - k, 1.6);
  });
}

// ───────────────────────── Holy seal ─────────────────────────

/** Holy seal: solid gold rings at the opponent's feet (outer ring, inner ring, four bearing gems) and twelve star-ray blades planted in the ground; hidden before the impact */
function makeSeal(c: UltCtx): Seal {
  const { sc, foe } = c;
  const P = mem(c).pal;
  const hf = hOf(c, foe);
  const R = hf * 0.62 + 0.55;
  const root = new THREE.Group();
  root.position.copy(sc.slots[foe].home).setY(0);
  const rings = new THREE.Group();
  const outer = solid(new THREE.TorusGeometry(R, R * 0.05, 6, 96), new THREE.Color(0xffffff).lerp(new THREE.Color(P.seal), 0.5), P.seal, 0.7);
  outer.rotation.x = -Math.PI / 2;
  outer.scale.z = 0.4;
  const inner = solid(new THREE.TorusGeometry(R * 0.78, R * 0.026, 5, 80), new THREE.Color(0xffffff).lerp(new THREE.Color(P.seal), 0.5), P.seal, 0.6);
  inner.rotation.x = -Math.PI / 2;
  inner.scale.z = 0.4;
  rings.add(outer, inner);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const gem = solid(new THREE.OctahedronGeometry(R * 0.09, 0), 0xffffff, P.core, 1.1);
    gem.position.set(Math.cos(a) * R, R * 0.03, Math.sin(a) * R);
    gem.scale.y = 1.6;
    rings.add(gem);
  }
  rings.position.y = 0.03;
  root.add(rings);
  // Twelve star-ray blades (the holy seal has its own set of geometry and materials: they are not released along with the morning star when it is removed)
  const bGeo = bladeGeo(0.16, 0.07);
  const bMat = sceneMaterial(new THREE.Color(0xffffff).lerp(new THREE.Color(P.blade), 0.55), { emissive: P.blade, emissiveAmt: 0.6, rim: 0 });
  const blades: SealBlade[] = [];
  for (let i = 0; i < BLADES; i++) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(bGeo, bMat);
    b.layers.enable(INK_LAYER);
    b.userData.inkScene = true;
    b.userData.inkHeavy = true;
    const L = hf * (i % 2 ? 0.42 : 0.62);
    b.scale.set(L * 0.9, L, L * 0.9);
    g.add(b);
    g.visible = false;
    root.add(g);
    blades.push({ g, from: V(), to: V(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), k: 0 });
  }
  root.visible = false;
  const s = { sink: 0, ring: 0, glow: 1 };
  const glowMats = [bMat, outer.material, inner.material] as unknown as EmU[];
  const glow0 = glowMats.map((mm) => mm.uniforms.uEmissiveAmt.value);
  const layer = sc.vfx.layer(root, (dt) => {
    glowMats.forEach((mm, i) => (mm.uniforms.uEmissiveAmt.value = glow0[i] * s.glow));
    rings.visible = s.ring > 0.001;
    rings.scale.setScalar(Math.max(1e-3, s.ring * (1 - s.sink)));
    rings.rotation.y += dt * 0.25;
    root.position.y = -s.sink * hf * 0.7;
    for (const b of blades) {
      if (b.k <= 0) continue;
      const k = Math.min(1, b.k);
      b.g.visible = true;
      b.g.position.lerpVectors(b.from, b.to, k).addScaledVector(UP, Math.sin(Math.PI * k) * hf * 0.45);
      b.g.quaternion.slerpQuaternions(b.qa, b.qb, k);
    }
  });
  registerInkRoot(root);
  return { root, blades, s, kill: () => layer.kill() };
}

/**
 * The star-ray blades fly out and plant into the ground: from is the burst point (world coordinates), the i-th lands at ring(i) (ground, holy seal coordinates), blade tip down, the blade leaning outward by tilt.
 * Each raises dust and a few soft sounds on landing; returns the time when all have landed.
 */
function plantBlades(c: UltCtx, tl: gsap.core.Timeline, at: number, from: THREE.Vector3, ring: (i: number) => THREE.Vector3, tilt: (i: number) => number, stagger = 0.02, dur = 0.24): number {
  const { sc, foe } = c;
  const m = mem(c);
  const seal = m.seal;
  if (!seal) return at;
  const P = m.pal;
  const hf = hOf(c, foe);
  seal.root.visible = true;
  seal.root.updateMatrixWorld(true);
  const local = seal.root.worldToLocal(from.clone());
  let end = at;
  seal.blades.forEach((b, i) => {
    const L = hf * (i % 2 ? 0.42 : 0.62);
    const g = ring(i);
    const out = g.clone().setY(0).normalize();
    const tl0 = tilt(i);
    // The blade grows out from +y: tip down, leaning outward
    const down = out.clone().multiplyScalar(Math.sin(tl0)).addScaledVector(UP, -Math.cos(tl0)).normalize();
    b.qb.setFromUnitVectors(UP, down);
    b.to.copy(g).addScaledVector(down, -L * 0.82);
    b.from.copy(local);
    b.qa.setFromEuler(new THREE.Euler(i * 1.7, i * 2.3, i * 0.9));
    b.k = 0;
    const t0 = at + i * stagger;
    tl.to(b, { k: 1, duration: dur, ease: 'power2.in' }, t0);
    tl.call(() => {
      const wp = seal.root.localToWorld(g.clone());
      sc.vfx.smoke({ pos: wp.clone().setY(0.1), count: low(c) ? 3 : 6, color: [0x8d8aa0, 0xc8c2d0], speed: [0.6, 1.8], dir: UP, spread: 0.7, life: [0.35, 0.7], size: [0.12, 0.28], sizeEnd: 0.5, radius: 0.12, drag: 2, gravity: -0.6 });
      sc.vfx.emit({ pos: wp, count: low(c) ? 4 : 8, color: [P.core, P.seal], speed: [1, 3], dir: UP, spread: 0.9, life: [0.2, 0.45], size: [0.03, 0.08], radius: 0.05, drag: 2, intensity: 0.9, atlas: 1 });
      if (i % 4 === 0) synth.tone({ type: 'triangle', f0: 2093 * (1 + (i / 4) * 0.12), f1: 1568, dur: 0.22, gain: 0.05 });
    }, [], t0 + dur);
    end = t0 + dur;
  });
  return end;
}

// ───────────────────────── Sound ─────────────────────────
// The night wind, neigh, chorus, wingbeats, flip, stomp, falling star, daybreak and bell are audio files generated by ElevenLabs (synthesized versions are used until they finish loading)

function sfxNight(): void {
  playOr(nightUrl, () => {
    synth.noise({ type: 'lowpass', f0: 2400, f1: 120, dur: 0.9, gain: 0.3, attack: 0.05 });
    synth.tone({ type: 'sine', f0: 64, f1: 38, dur: 1.0, gain: 0.3, attack: 0.1 });
  }, { gain: 0.8 });
}

function sfxChoir(dur: number): void {
  playOr(choirUrl, () => {
    for (const [f, d] of [[220, 0], [277.2, 6], [329.6, -5], [440, 4], [554.4, -7]] as const) {
      synth.tone({ type: 'triangle', f0: f, dur, gain: 0.045, attack: dur * 0.45, detune: d });
      synth.tone({ type: 'sine', f0: f * 2, dur: dur * 0.9, gain: 0.02, attack: dur * 0.6, detune: -d });
    }
  }, { gain: 0.55 });
  synth.tone({ type: 'sine', f0: 55, dur: dur * 0.9, gain: 0.12, attack: dur * 0.4 });
}

function sfxDawn(): void {
  sfx.impactBig();
  ultSfx.thump(0.7);
  playOr(dawnUrl, () => {
    for (const [f, d] of [[880, 0], [1108.7, 0.03], [1318.5, 0.06], [1760, 0.1]] as const) synth.tone({ type: 'triangle', f0: f, dur: 1.4, gain: 0.08, delay: d });
  }, { gain: 0.55 });
  playOr(bellUrl, () => {
    for (const f of [523.25, 659.25, 784]) synth.tone({ type: 'sine', f0: f, dur: 2.2, gain: 0.06 });
  }, { gain: 0.6, delay: 0.04 });
}

// ───────────────────────── Cinematic ─────────────────────────

/** Nightfall → rear and neigh → morning star rises → Revelation → a beat of silence */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side } = c;
  const m = mem(c);
  m.dawn = readPhase(c);
  m.pal = m.dawn ? DAWN : DUSK;
  const P = m.pal;
  const A = act(c);
  const g = geoSpec(c);
  m.geo = g;
  const h = g.h;
  const lo = low(c);

  // Build the morning star, comet tail and holy seal and compile the shaders first (all hidden for now), so there is no hitching midway through the cinematic
  m.world = scanWorld(c);
  sc.fieldFx.hold = true;
  sc.fieldFx.holdFx = true;
  m.unreg = sc.addCleanup(() => restoreWorld(c));
  m.layers.push(sc.vfx.layer(new THREE.Object3D(), () => writeNight(c)));
  m.star = makeStar(c, g.R, g.Slow);
  m.trail = makeTrail(c, g.curve, P);
  m.seal = makeSeal(c);
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), m.world.silMat);
  warm.visible = false;
  m.star.root.add(warm);
  sc.stage.prewarm();
  const star = m.star;
  const head = sc.head(side);

  const tl = sc.gs.timeline('world');
  // ① Nightfall: at the announcement, hard cut to a low angle in front of the face, the sky pressed into a starry night
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    synth.dropMusic();
    preloadSamples(...FILES);
    sfxNight();
    cine.track(() => sc.head(side), ['vig']);
    void cine.look({ letterbox: 1, vignette: 0.6, grain: 0.15, bloom: 0.8, desat: 0 }, 0.5, ease.outQuad);
    const face = head.clone().add(V(0, h * 0.05, 0));
    cine.cut(cine.orbitPos(side, head, 38, h * 0.8, -h * 0.06), face);
    void cine.shot(cine.orbitPos(side, head, 33, h * 0.68, -h * 0.05), face, 0.7, ease.outQuad);
    // The glow on the opponent is also pressed down, so at night only the morning star shines
    sc.slots[c.foe].creature?.setGlowMul(0.25);
  }, [], 0);
  // In the close-up the horse is tinted a pale indigo-white of moonlight (the face is clearly visible), and only when cutting to the full body is the whole horse pressed into a silhouette
  m.moon = 1;
  tl.to(m, { night: 1, sil: 1, duration: 0.7, ease: 'power1.inOut' }, 0.05);
  tl.to(A, { focus: 1, duration: 0.3, ease: 'power2.out' }, 0);
  tl.to(A, { star: 1, duration: 0.35, ease: 'power2.out' }, 0.12);
  tl.call(() => {
    const p = anchorPos(c, 'star', () => sc.head(side).add(V(0, h * 0.12, 0)));
    // Additive light sprites in front of the face: small, and not longer than 0.2 s
    void sc.vfx.glint(p, P.core, h * 0.07, 0.18, 1.6);
    synth.tone({ type: 'sine', f0: 1760, dur: 0.6, gain: 0.04, attack: 0.02 });
  }, [], 0.2);
  tl.call(() => {
    const eyes = sc.eyes(side);
    for (const e of eyes.length ? eyes : [sc.head(side)]) void sc.vfx.glint(e, P.core, h * 0.045, 0.16, 1.4);
    ultSfx.shing();
  }, [], 0.32);

  // ② Rear and neigh: cut to a low-angle full-body shot, the horse rears up, both wings spread and raised high, head thrown back in a long neigh; the camera retreats along the same line
  const T_REAR = 0.72;
  const T_RISE = 1.35;
  const T_FLARE = 2.25;
  const T_HUSH = 2.62;
  const T_END = 2.85;
  tl.call(() => {
    cine.track(() => g.N, ['vig']);
    void cine.look({ vignette: 0.5 }, 0.3);
    playOr(neighUrl, () => synth.tone({ type: 'sawtooth', f0: 520, f1: 780, dur: 0.9, gain: 0.05, attack: 0.1 }), { gain: 0.7, peakIn: 0.45 });
    ultSfx.thump(0.3);
    sc.rig.addTrauma(0.15);
    for (const n of ['hoofHL', 'hoofHR']) {
      const p = anchorPos(c, n, () => sc.slots[side].home.clone());
      sc.vfx.smoke({ pos: p.setY(0.1), count: lo ? 5 : 10, color: [0x2a2f5a, 0x3c4278], speed: [0.8, 2.2], dir: UP, spread: 0.9, life: [0.5, 0.9], size: [0.18, 0.4], sizeEnd: 0.7, radius: 0.2, drag: 1.8, gravity: -0.4 });
    }
  }, [], T_REAR);
  tl.set(m, { moon: 0 }, T_REAR);
  tl.to(A, { rear: 1, duration: 0.42, ease: 'power2.out' }, T_REAR);
  tl.to(A, { spread: 1, duration: 0.5, ease: 'power2.out' }, T_REAR);
  tl.to(A, { flap: -1, duration: 0.45, ease: 'power2.out' }, T_REAR + 0.05);
  tl.to(A, { raise: 1, duration: 0.3, ease: 'power2.out' }, T_REAR + 0.2);
  // Camera: while rearing it retreats from 0.85x distance to 1x; after the morning star rises, the dolly zoom goes to d1 (the focal length lengthens at the same time, the horse's size unchanged)
  {
    const st = sc.stage;
    let f0 = 35;
    let tan0 = 1;
    const span = T_HUSH - T_REAR;
    tl.call(() => {
      f0 = st.camera.fov / st.fovScale;
      tan0 = Math.tan(THREE.MathUtils.degToRad(f0) * 0.5);
    }, [], T_REAR);
    camRig(c, tl, T_REAR, span, 'none', (k, pos, look) => {
      const t = T_REAR + k * span;
      if (t < T_RISE) {
        const q = ease.outCubic((t - T_REAR) / (T_RISE - T_REAR));
        dollyCam(g, g.d0 * (0.85 + 0.15 * q), pos, look);
        return;
      }
      const q = ease.inOutQuad(Math.min(1, (t - T_RISE) / (T_HUSH - T_RISE)));
      const d = g.d0 + (g.d1 - g.d0) * q;
      dollyCam(g, d, pos, look);
      st.setFovScale((2 * THREE.MathUtils.radToDeg(Math.atan((tan0 * g.d0) / d))) / f0);
      sc.syncParticleScale();
    });
  }

  // ③ Morning star rises: it rises from the horizon behind the horse, and the backlight frames the rearing horse as a silhouette; a reflection of starlight spreads across the ground
  tl.call(() => {
    star.root.visible = true;
    sfxChoir(1.6);
    cine.track(() => star.root.position, ['vig']);
    void cine.look({ bloom: 0.9, vignette: 0.62 }, 0.8);
    const camG = g.N.clone().addScaledVector(g.dirH, g.d1).setY(0.05);
    groundBand(c, g.S.clone().setY(0.05), camG, h * 0.35, P.star, 2.4);
  }, [], T_RISE);
  tl.to(star.pos, { y: g.S.y, duration: 0.85, ease: 'power2.out' }, T_RISE);
  tl.to(star.s, { scale: 1, glow: 1, ext: 0.6, duration: 0.85, ease: 'power2.out' }, T_RISE);
  tl.to(A, { beat: 0.35, duration: 0.4, ease: 'power1.inOut' }, T_RISE);

  // ④ Revelation: the star-ray blades extend all at once, the radial rays open; the horse makes one downstroke
  tl.to(A, { beat: 0, duration: 0.12 }, T_FLARE - 0.12);
  tl.to(star.s, { ext: 1, flare: 1, duration: 0.35, ease: 'back.out(1.7)' }, T_FLARE);
  tl.to(A, { flap: 1, duration: 0.16, ease: 'power3.in' }, T_FLARE);
  tl.to(A, { flap: -0.35, duration: 0.4, ease: 'power2.out' }, T_FLARE + 0.18);
  tl.call(() => {
    ultSfx.shing(0.75);
    synth.tone({ type: 'sine', f0: 660, f1: 1320, dur: 0.6, gain: 0.05, attack: 0.25 });
    void cine.pulse({ bloom: 1.1 }, { bloom: 0.9 }, 0.5);
  }, [], T_FLARE);
  tl.call(() => {
    playOr(wingsUrl, () => sfx.whooshBig(), { gain: 0.9 });
    sc.rig.addTrauma(0.3);
    for (const n of ['wingTipL', 'wingTipR']) {
      const p = anchorPos(c, n, () => sc.center(side).add(V(0, h * 0.4, 0)));
      sc.vfx.emit({ pos: p, count: lo ? 8 : 18, color: [0xffffff, P.core], speed: [1.5, 4], dir: V(0, -1, 0), spread: 0.9, life: [0.6, 1.2], size: [0.08, 0.16], sizeEnd: 0.05, radius: h * 0.15, drag: 1.8, gravity: 0.6, intensity: 0.8, atlas: 3, spin: 4 });
      sc.vfx.emit({ pos: p, count: lo ? 10 : 24, color: [P.star, P.core], speed: [2, 5], dir: V(0, -1, 0), spread: 1, life: [0.3, 0.7], size: [0.03, 0.07], radius: h * 0.2, drag: 2, intensity: 0.9, atlas: 1 });
    }
    const home = sc.slots[side].home.clone().setY(0.08);
    void sc.vfx.ring(home, P.star, 0.3, h * 1.3, 0.45);
    sc.vfx.smoke({ pos: home, count: lo ? 8 : 16, color: [0x252a52, 0x363c70], speed: [2, 4], dir: UP, spread: 1.4, life: [0.5, 0.9], size: [0.2, 0.45], sizeEnd: 0.8, radius: h * 0.35, drag: 2, gravity: -0.3 });
  }, [], T_FLARE + 0.14);

  // ⑤ A beat of silence: the star core shrinks and the star-ray blades draw inward
  tl.to(star.s, { core: 0.45, ext: 0.8, flare: 0.6, duration: 0.2, ease: 'power2.in' }, T_HUSH);
  tl.call(() => {
    synth.duck(8);
    synth.tone({ type: 'sine', f0: 3520, dur: 0.22, gain: 0.03 });
  }, [], T_HUSH);
  tl.set({}, {}, T_END);
  await playTimeline(tl);
}

/** Backlight flip → black sun → stamp and throw the star → follow shot → target's view */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const star = m.star;
  const g = m.geo;
  if (!star || !g) return;
  const P = m.pal;
  const A = act(c);
  const h = g.h;
  const hf = hOf(c, foe);
  const lo = low(c);
  const curve = g.curve;
  const trail = m.trail;
  const sign = m.dawn ? -1 : 1;
  const T_FLIP = 0.42;
  const T_SNAP = 0.54;
  const T_LAND = 0.7;
  const T_TV = 1.02;
  const T_HIT = 1.36;
  const FLY = T_HIT - T_SNAP;

  const tl = sc.gs.timeline('world');
  // ① Backlight flip: the frame rolls 180° while pushing in; the star core swells and the radial rays open all the way
  tl.call(() => {
    playOr(flipUrl, () => {
      synth.noise({ type: 'highpass', f0: 800, f1: 5000, dur: T_FLIP, gain: 0.25, attack: T_FLIP * 0.9 });
      synth.tone({ type: 'sine', f0: 36, f1: 90, dur: T_FLIP, gain: 0.35, attack: T_FLIP * 0.6 });
    }, { gain: 0.85, peakIn: T_FLIP });
    void cine.look({ roll: sign * Math.PI, fov: sc.stage.fovScale * 0.84 }, T_FLIP, ease.inQuad);
  }, [], 0);
  tl.to(star.s, { core: 1.25, scale: 1.2, flare: 1.3, ext: 0.9, duration: T_FLIP, ease: 'power2.in' }, 0);
  // ② Black sun: at the instant the flip finishes the whole frame inverts (not tweened: the middle values would just be a sheet of grey)
  tl.call(() => {
    void cine.look({ invert: 1 }, 0);
    sc.stage.chromatic(0.7);
    ultSfx.thump(0.45);
  }, [], T_FLIP);

  // ③ Back to upright, cut to the follow shot: the horse's forehooves come down, and the morning star leaves the sky and falls along an arc toward the opponent
  const fl = { u: 0 };
  const sp = V();
  const tan = V();
  tl.call(() => {
    void cine.look({ invert: 0, roll: 0, fov: 1.05, radial: 0.2 }, 0);
    sc.stage.chromatic(0.4);
    cine.track(() => star.root.position, ['vig', 'radial']);
    playOr(fallUrl, () => {
      synth.tone({ type: 'sawtooth', f0: 1800, f1: 260, dur: FLY, gain: 0.06 });
      synth.noise({ type: 'bandpass', f0: 3400, f1: 700, q: 2, dur: FLY, gain: 0.3 });
    }, { gain: 0.75, endIn: FLY });
    star.pos.copy(curve.getPointAt(0));
  }, [], T_SNAP);
  tl.to(A, { rear: 0, duration: T_LAND - T_SNAP, ease: 'power3.in' }, T_SNAP);
  tl.to(A, { raise: 0.2, flap: 0.6, duration: T_LAND - T_SNAP, ease: 'power2.in' }, T_SNAP);
  tl.to(A, { flap: 0, star: 0, duration: 0.45, ease: 'power2.out' }, T_LAND);
  tl.call(() => {
    playOr(stompUrl, () => ultSfx.thump(0.8), { gain: 1 });
    ultSfx.thump(0.5);
    sc.rig.addTrauma(0.45);
    for (const n of ['hoofL', 'hoofR']) {
      const p = anchorPos(c, n, () => sc.slots[side].home.clone().addScaledVector(g.fwd, h * 0.3)).setY(0.06);
      void sc.vfx.decal(p, crackTex(3), P.star, h * 0.7, 1.6, undefined, 0.8);
      sc.vfx.smoke({ pos: p.clone().setY(0.1), count: lo ? 6 : 12, color: [0x252a52, 0x3c4278], speed: [1.5, 3.5], dir: UP, spread: 1.3, life: [0.4, 0.8], size: [0.18, 0.4], sizeEnd: 0.7, radius: 0.2, drag: 2, gravity: -0.4 });
    }
    const home = sc.slots[side].home.clone().setY(0.08);
    void sc.vfx.ring(home.addScaledVector(g.fwd, h * 0.3), P.star, 0.3, h * 1.6, 0.4);
  }, [], T_LAND);
  // Morning star: shrunk to a size that can be thrown, the star-ray blades folding back into tail feathers
  tl.to(star.s, { scale: 0.5, fold: 1, halo: 0.5, core: 1, flare: 0.8, duration: 0.22, ease: 'power2.out' }, T_SNAP);
  tl.to(fl, {
    u: 1,
    duration: FLY,
    ease: 'power2.in',
    onUpdate: () => {
      curve.getPointAt(fl.u, sp);
      curve.getTangentAt(fl.u, tan);
      star.pos.copy(sp);
      star.vel.copy(tan);
      trail?.set(fl.u, fl.u - 0.4, g.R * 0.32, Math.min(1, 0.3 + fl.u * 10));
      sc.vfx.emit({ pos: sp, count: lo ? 1 : 3, color: [P.core, P.star, P.halo], speed: [0.3, 1.2], dir: tan.clone().negate(), spread: 0.5, life: [0.3, 0.6], size: [0.05, 0.12], sizeEnd: 0.02, radius: g.R * 0.2, drag: 2, intensity: 0.85, atlas: 1 });
    },
  }, T_SNAP);
  tl.to(star.s, { scale: 0.62, duration: FLY - 0.22, ease: 'power1.in' }, T_SNAP + 0.22);
  // Follow shot: audience side 76°, at first framing the stomping horse and the star over its head, then panning with the head of the star toward the opponent
  {
    const home = sc.slots[side].home.clone().setY(0);
    const foeHome = sc.slots[foe].home.clone().setY(0);
    const dist = fitDist(c, h * 2.7, h * 3.4, 1.05);
    camRig(c, tl, T_SNAP, T_TV - T_SNAP, 'none', (_k, pos, look) => {
      look.copy(home).lerp(foeHome, 0.08 + fl.u * 0.55).add(V(0, h * 0.78, 0));
      pos.copy(cine.orbitPos(side, look, 76, dist, h * 0.28));
    });
  }
  // ④ Target's view: a low angle behind the opponent on the audience side, the stomping horse far away, the morning star falling toward the camera
  {
    const foeC = sc.center(foe);
    const lookAt = () => foeC.clone().lerp(sc.head(side), 0.5).add(V(0, h * 0.42, 0));
    const p0 = cine.orbitPos(foe, foeC, 150, hf * 1.45 + 2.3, -hf * 0.12);
    const p1 = cine.orbitPos(foe, foeC, 148, hf * 1.3 + 2.0, -hf * 0.12);
    tl.call(() => {
      void cine.look({ fov: 1.1, radial: 0.3 }, 0);
      cine.cut(p0, lookAt());
      void cine.shot(p1, lookAt(), T_HIT - T_TV, ease.inQuad);
      void cine.pulse({ radial: 0.45 }, { radial: 0.2 }, 0.3);
      ultSfx.swell(T_HIT - T_TV, 0.25);
    }, [], T_TV);
  }
  tl.set({}, {}, T_HIT);
  await playTimeline(tl);
}

/** Daybreak: the morning star bursts, the star-ray blades plant into the ground around the opponent, the gold ring and light pillars emerge; the camera holds at the target's view and then retreats back and up */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe } = c;
  const m = mem(c);
  const P = m.pal;
  const hf = hOf(c, foe);
  const pos = sc.center(foe);
  const home = sc.slots[foe].home.clone().setY(0);
  const lo = low(c);
  sc.stage.screenFlash(P.core, 0.3, 7);
  if (ev.hitIndex < ev.hits) return;
  const star = m.star;
  const hitAt = star ? star.pos.clone() : pos.clone();
  star?.kill();
  m.star = undefined;
  m.trail?.kill();
  m.trail = undefined;
  sfxDawn();
  cine.shock(pos, 1.3, 0.75, 1.2);
  void cine.pulse({ radial: 0.8 }, { radial: 0 }, 0.55);
  sc.stage.chromatic(0.6);
  const fc = sc.slots[foe].creature;
  fc?.setGlowMul(1);
  fc?.setFlash(P.dawnBot, 0.6);
  void sc.vfx.glint(hitAt, P.core, hf * 0.45, 0.45, 3.5);
  starBurst(c, hitAt, hf * 0.5, hf * 2.4, 0.6);
  void sc.vfx.ring(home.clone().setY(0.12), P.seal, 0.4, hf * 2.6, 0.5);
  dawnBeam(c, home, hf * 0.2 + 0.18, 14, P.seal, 1.4);
  // The horizon already lights up a stretch on the very frame of the impact
  m.boost = Math.max(m.boost, 0.35);
  sc.vfx.emit({ pos: hitAt, count: lo ? 30 : 70, color: [P.core, P.star, P.halo], speed: [3, 9], life: [0.35, 0.8], size: [0.06, 0.16], sizeEnd: 0.02, radius: hf * 0.2, drag: 1.6, gravity: -2, intensity: 1, atlas: 1 });

  const seal = m.seal;
  const tl = sc.gs.timeline('world');
  // Daybreak: the horizon lights up, the silhouettes release (the night does not recede, to keep the contrast)
  tl.to(m, { boost: 1, sil: 0, duration: 0.35, ease: 'power2.out' }, 0);
  tl.to(m, { night: 0.85, duration: 0.35 }, 0);
  if (seal) {
    const R = hf * 0.62 + 0.55;
    const end = plantBlades(c, tl, 0.02, hitAt, (i) => {
      const a = (i * Math.PI * 2) / BLADES + Math.PI / BLADES;
      return V(Math.cos(a) * R * 0.97, 0, Math.sin(a) * R * 0.97);
    }, () => 0.32);
    tl.to(seal.s, { ring: 1, duration: 0.32, ease: 'back.out(1.5)' }, 0.1);
    tl.fromTo(seal.s, { glow: 2.2 }, { glow: 1, duration: 1.2, ease: 'power2.out', immediateRender: false }, end);
    tl.call(() => {
      void sc.vfx.decal(home.clone().setY(0.05), runeCircleTex(5), P.seal, R * 2.3, 1.8, 0, 0.35);
      void sc.vfx.ring(home.clone().setY(0.1), P.seal, R * 0.4, R * 2.4, 0.6);
      sc.rig.addTrauma(0.25);
    }, [], end);
  }
  // Gold flecks and white feathers slowly fall
  tl.call(() => {
    sc.vfx.emit({ pos: pos.clone().add(V(0, hf * 0.9, 0)), count: lo ? 12 : 30, color: [0xffffff, P.core], speed: [0.3, 1.2], spread: 1.5, life: [1.4, 2.2], size: [0.08, 0.15], sizeEnd: 0.06, radius: hf * 0.8, drag: 2.5, gravity: 0.35, intensity: 0.7, atlas: 3, spin: 3 });
    sc.vfx.emit({ pos: pos.clone().add(V(0, hf * 0.6, 0)), count: lo ? 12 : 26, color: [P.seal, P.core], speed: [0.2, 0.8], spread: 1.5, life: [1, 1.8], size: [0.03, 0.07], radius: hf * 0.7, drag: 2, gravity: 0.25, intensity: 0.8, atlas: 1 });
  }, [], 0.12);
  // The camera retreats back and up from the target's view and turns a little toward the audience side (so both the holy seal planted in the ground and the horse come into frame, and the way back to the wide shot is shorter).
  // Distance and height are computed from the holy seal's radius: a big opponent (the whale) would block the ring on the ground, so it retreats to at least three and a half times the ring and about 30° of depression
  tl.call(() => {
    const r = sc.rig;
    const foeC = sc.center(foe);
    const R = hf * 0.62 + 0.55;
    const d = Math.max(r.pos.clone().sub(foeC).setY(0).length() * 1.3, R * 3.5 + hf * 0.8);
    const rise = Math.max(r.pos.y - foeC.y + hf * 0.45, d * 0.58);
    const look = home.clone().lerp(sc.slots[c.side].home, 0.3).setY(hf * 0.3);
    const to = cine.safe(cine.orbitPos(foe, foeC, 118, d, rise), look);
    void cine.shot(to, look, 0.9, ease.outCubic);
    void cine.look({ fov: 1.05, radial: 0 }, 0.6);
  }, [], 0.32);
  tl.call(() => settleNight(c, 0.5), [], 0.95);
  void playTimeline(tl);
}

/** Ease the post-processing back and the night back by half; after holding for hold seconds the camera pulls back to the wide shot, where the post-hit battle text is read */
function settleNight(c: UltCtx, hold: number): void {
  const { sc, cine } = c;
  const m = mem(c);
  void cine.look({ lines: 0, radial: 0, haze: 0, isolate: 0, desat: 0, grain: 0, bloom: sc.stage.bloomBase * 0.9, vignette: 0.5 }, 0.6);
  const n0 = m.night;
  const b0 = m.boost;
  const s0 = m.sil;
  void sc.tw.to(0.7, (k) => {
    m.night = n0 + (Math.min(n0, 0.5) - n0) * k;
    m.boost = b0 + (Math.min(b0, 0.5) - b0) * k;
    m.sil = s0 * (1 - k);
  }, ease.inOutQuad, 'fx');
  void c.wait(hold).then(() => {
    cine.track(null);
    void sc.rig.reset(0.8);
    void cine.look({ fov: 1, roll: 0 }, 0.8);
  });
}

/** Blocked (only "Dusk" can happen): the morning star shatters against the barrier, the star-ray blades scatter and plant in the ground, the starry sky goes dark star by star, and daybreak does not come */
async function guarded(c: UltCtx): Promise<void> {
  const { sc, foe } = c;
  const m = mem(c);
  const P = m.pal;
  const hf = hOf(c, foe);
  const pos = sc.center(foe);
  const star = m.star;
  const hitAt = star ? star.pos.clone() : pos.clone();
  star?.kill();
  m.star = undefined;
  m.trail?.kill();
  m.trail = undefined;
  sc.vfx.emit({ pos: hitAt, count: low(c) ? 25 : 55, color: [P.star, P.core], speed: [2, 6], life: [0.4, 0.9], size: [0.05, 0.14], sizeEnd: 0.02, radius: hf * 0.3, gravity: -4, drag: 1.5, intensity: 0.85, atlas: 2 });
  void sc.vfx.debris(hitAt, P.seal, 10, 5, 1.1, hf * 0.06, hf * 0.8);
  void sc.vfx.ring(hitAt, P.star, 0.3, hf * 0.8 + 0.6, 0.5, sc.stage.camera.position.clone().sub(hitAt));
  playSample(bellUrl, { gain: 0.35, rate: 0.7 });
  synth.tone({ type: 'triangle', f0: 1760, f1: 880, dur: 0.6, gain: 0.06 });
  const tl = sc.gs.timeline('world');
  const R = hf * 0.62 + 0.55;
  // Scattering: the star-ray blades bounce off and plant at an angle in places further out than the holy seal
  plantBlades(c, tl, 0.02, hitAt, (i) => {
    const a = (i * Math.PI * 2) / BLADES + Math.sin(i * 7.1) * 0.25;
    const r = R * (1.25 + 0.45 * (0.5 + 0.5 * Math.sin(i * 3.7)));
    return V(Math.cos(a) * r, 0, Math.sin(a) * r);
  }, (i) => 0.5 + 0.35 * Math.sin(i * 2.3), 0.015, 0.3);
  tl.to(m, { sil: 0.55, duration: 0.4 }, 0);
  // The starry sky goes dark star by star
  tl.call(() => {
    const u = sc.arena.skyMat.uniforms;
    void sc.tw.to(0.8, () => {
      if (!sc.disposed) u.uStars.value = Math.random() > 0.5 ? 1 : 0;
    }, ease.linear, 'fx').then(() => {
      if (!sc.disposed) u.uStars.value = 0;
    });
  }, [], 0.15);
  void playTimeline(tl);
  await ultGuarded(c);
}

/** Afterglow: the horse folds its wings and returns to idle, the star-ray blades and gold ring sink into the ground, the night recedes, and everything is restored */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  const A = act(c);
  const tl = sc.gs.timeline('world');
  tl.to(A, { focus: 0, rear: 0, raise: 0, spread: 0, flap: 0, beat: 0, star: 0, duration: 0.6, ease: 'power2.inOut' }, 0);
  tl.to(m, { night: 0, boost: 0, sil: 0, duration: 1.1, ease: 'power1.inOut' }, 0);
  if (m.seal) tl.to(m.seal.s, { sink: 1, duration: 0.8, ease: 'power2.in' }, 0.15);
  tl.set({}, {}, 1.15);
  await playTimeline(tl);
  restoreWorld(c);
  m.unreg?.();
  m.unreg = undefined;
}

export default defineSsr({
  windup,
  deliver,
  impact,
  guarded,
  settle: (c) => settleNight(c, 0.5),
  after,
  quietHit: true,
  pinFoe: true,
});
