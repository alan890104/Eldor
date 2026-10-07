// Thalassene, the Tide Singer: "Spring Tide Aria"
//
// What this cinematic is about: the whale closes its eyes and sings, calling the night and the full moon into the sky; the sea rises with its song until it fills the whole arena, and under the moon it raises its tail fluke high and dives into the sea,
// then, wearing its tide crown, breaks through the waves straight at the opponent, breaches in front of the opponent, sings the highest note before the full moon (the spring tide), rolls over and crashes down, the whole sea pressing down on the opponent with it.
//
// Why it is no longer one continuous shot: the old version's long shot was a small boat floating on the water that could only drift and circle slowly, so the whale's own movement could not be seen (the old model was also just glowing parts turning).
// The new model is a whole whale that can pitch, roll and flick its tail, and its most powerful images are the tail fluke raised high on the dive, the breach through the waves, and the roll and crash, each with its own best camera position
// (the fluke is seen from behind, where the ripple pattern on its underside shows; the breach must be looked up at from behind the opponent; the crash must be seen from the side to show the whale, the arc and the opponent together), so it was changed to a cut of five shots.
// The two best things of the old version are kept: the half-water, half-sky frame as the sea rises past the camera (the second shot), and, at impact, the sea flooding over the camera and then draining off it (impact).
// The beats hung on the old parts, the musical notes, halos and star patterns, are removed entirely and replaced by the whale's own movement and solid water.
//
// Model: src/render/lab/thalasseneModel.ts. Action weights: focus (steady), sing (eyes closed singing, head thrown back, pectoral fins open), glow (gems and iris),
// breach (head up, leaping), dive (head down, diving), roll (rolling about the long axis, -1 to 1), fluke (fluke curled up), swim (swimming hard).
// Positions come only from anchors: eyes, snout, blowhole, crownGem, finL/finR, belly, core, throat, crown, fluke, flukeL/flukeR, tailGem; the legacy model falls back to estimates.
// The whale's overall movement (diving, cruising submerged, breaching, crashing down, returning to place) is handled by the "swim layer", which every frame converts the world position of the center of mass into the shell's root (horizontal) and hover (height);
// pitch, roll and fin movement are left to the model's action weights. root's height stays at 0 the whole time, so when it returns to place at wrap-up the director does not jump it back again.
// The sea surface, the moon and the water crown (a crown-shaped wall of water formed by the splash) are solid scene objects (opaque, outline layer on): the sea surface uses its own cartoon shading, while the moon and water crown use sceneMaterial;
// droplets, mist, glow and sound waves go through VFX.
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed)
//   windup
//     0.00  Announcement: letterbox, the music is pulled out, a long whale song; the sky begins to turn into a moonlit night.
//           Camera A: audience side 60°, a three-quarter profile of the face slightly below the eyes, pushing in and turning to 52° within 1.08 s; the eyes are placed at the upper third of the frame (the ultimate's name banner is below).
//           It steadies (focus) and sings with its eyes closed (sing: head thrown back, pectoral fins open), the tide crown gem lights up (glow); three rings of fine sound waves ripple outward in front of the mouth. Sound: whale song.
//     0.50  Blow: the blowhole sprays a column of mist and droplets, the tide crown gem flashes; the sea begins to rise from underground (not yet visible in this shot). Sound: the blow.
//     0.82  Eyes open: the eyes open, eye glints.
//     1.08  Moonrise (cut): Camera B: directly behind the whale toward the audience side at 146°, the camera hugging the ground at eye level; the sky goes fully black into a moonlit night within 0.45 s, and the full moon rises from behind the whale;
//           for the first 0.3 s the sea rises past the camera, which floats on the waterline: the lower half is underwater, the upper half the whale and the full moon above the surface. The whale settles to float on the sea. Sound: the tide surging up, the second phrase of whale song.
//     1.86  Dive: the whale lowers its head about 60° (dive) and curls its fluke up another 25° (fluke), the tail stock nearly vertical, so the ripple pattern on the fluke's underside can be seen from behind;
//           the camera slowly pushes in and tilts up following the fluke, water hanging from the fluke running down its trailing edge. At 2.42 the fluke slides into the sea, throwing up a small ring of water crown. Sound: the fluke slapping the water (loudest at the entry).
//     2.58  End
//   deliver
//     0.00  Cruising submerged (cut): Camera C: diagonally behind it on the audience side, hugging the sea surface and gliding forward along; the tide crown and dorsal fin cut through the surface in the foreground, trailing a V-shaped wake,
//           the opponent growing closer ahead, the full moon hanging behind the opponent. The whale swims at full speed beneath the surface (swim). Sound: cutting through the water (loudest at about 0.45).
//     0.74  Target's view (cut): Camera D: diagonally behind the opponent on the audience side, hugging the sea surface; the opponent in one corner of the foreground, the sea surface swelling in front of it.
//     0.80  Breach: the whale bursts vertically out of the sea, rolling over as it goes, its blue back and flank turning toward the camera (the white throat and belly turning away), a ring of water crown wrapping around it and spraying upward, droplets flung from its whole body;
//           the camera tilts up following it and backs off a little. Sound: breaking the waves.
//     1.28  Apex, Song of the Spring Tide: time slows (0.3x for 0.52 s). The full moon is behind it on the side away from the opponent, only the whale's head cutting across the edge of the moon, the whole whale's silhouette set against the night sky;
//           it sings the highest note: the tide crown gem flashes, and two faint rings of sound waves ripple out along the sea surface from beneath it. Sound: a soaring whale song.
//     1.62  Crash (cut): Camera E: side-on, audience side 90°, seeing the whale in midair, the arc downward and the opponent at once; it rolls over, white throat and belly up, and crashes down on the opponent (roll, dive).
//     2.04  Arrives (handed to the director to play the impact)
//   impact (quietHit: the impact visuals are made by itself)
//     0.00  Spring tide: hit-stop, a ball of white light at the point of contact; a water crown (its upper edge a ring of white foam, with spray constantly flung from the edge) surges up around the opponent,
//           a high wave pushes outward, droplets and white mist bursting upward; it rolls over and sinks into the sea. Sound: the huge whale smashing the water, waves collapsing.
//     0.18  The high wave hits the camera: the water level rises past the camera, which is underwater for 0.3 s (deep blue, caustics, bubbles).
//     0.50  Tide ring: as the high wave pushes outward, another ring of white wave closes in on where the whale stood (surge and ebb happen at the same time).
//     0.56  The camera surfaces and retreats back and up into an overhead view, the droplets hanging on the lens slowly sliding off; the water crown sinks back into the sea; from 0.70 the full moon sinks into the horizon.
//     0.62  It swims back under the surface to its place, at 1.04 it floats up to the sea surface from its place, and at 1.54 it blows a column of mist.
//     0.95  Post-processing eases back, and after holding 0.45 s it pulls back to the wide shot (the battle text is read on the moonlit sea)
//   guarded: the whale crashes onto the barrier and is bounced off, thrown in an arc and falling slantwise back into the sea, the water crown only half rising; then the shared "barrier almost shattered, finally holds", and it floats up from its place.
//   miss: it crashes into an empty sea, the water crown surges up, and then it floats up from its place.
//   after: the sea drains back underground and the sky returns to daytime; the whale rises from the sea surface back to its original height, and the weights go to zero.

import * as THREE from 'three';
import { playOr, preloadSamples, type SampleVoice } from '../../../audio/samples.ts';
import { synth } from '../../../audio/sfx.ts';
import ariaUrl from '../../../audio/sfx/thalassene-aria.mp3';
import blowUrl from '../../../audio/sfx/thalassene-blow.mp3';
import breachUrl from '../../../audio/sfx/thalassene-breach.mp3';
import crashUrl from '../../../audio/sfx/thalassene-crash.mp3';
import flukeUrl from '../../../audio/sfx/thalassene-fluke.mp3';
import rushUrl from '../../../audio/sfx/thalassene-rush.mp3';
import slamUrl from '../../../audio/sfx/thalassene-slam.mp3';
import songUrl from '../../../audio/sfx/thalassene-song.mp3';
import surgeUrl from '../../../audio/sfx/thalassene-surge.mp3';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { sceneMaterial } from '../../../render/spiritToon.ts';
import { glowTex } from '../../../render/textures.ts';
import { LIGHT } from '../../../render/toon.ts';
import { ease } from '../../../render/tween.ts';
import type { FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, eyeGlint, settle } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [songUrl, blowUrl, surgeUrl, flukeUrl, rushUrl, breachUrl, ariaUrl, slamUrl, crashUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const CYAN = 0x7ff0ff;
const CYAN_HI = 0xd8fbff;
const FOAM = 0xf2fbff;
const SPRAY = [0xe6f4ff, 0xc6e2ff, 0xffffff];
const MOONLIGHT = 0xbcd0ff;
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};

// Timetable (seconds): each beat of the shot list; the seconds in the file header match these
const T = {
  blow: 0.5,
  open: 0.82,
  moon: 1.08,
  flood: 0.7,
  dive: 1.86,
  under: 2.42,
  windup: 2.58,
  // deliver
  cutD: 0.74,
  erupt: 0.8,
  apex: 1.28,
  fall: 1.62,
  deliver: 2.04,
};

// ───────────────────────── State ─────────────────────────

/** The geometry of this cinematic: all computed from the positions, heights and anchors of the two sides */
interface Geo {
  h: number;
  hf: number;
  /** Scale of the shell (model units → world units) */
  s: number;
  /** Position of the center of mass in the model (body coordinates, unscaled) */
  piv: THREE.Vector3;
  hover0: number;
  yaw: number;
  /** Sign of roll: makes the white throat and belly roll toward the audience side */
  rollSign: number;
  /** The horizontal direction from the caster toward the opponent, and the horizontal direction of the audience side */
  f: THREE.Vector3;
  a: THREE.Vector3;
  home: THREE.Vector3;
  foe: THREE.Vector3;
  /** The whale's full length (world units) */
  len: number;
  /** Sea level */
  sea: number;
  /** Center of mass: standing on land, floating on the sea, sunk underwater */
  rest: THREE.Vector3;
  float: THREE.Vector3;
  /** The breach point (on the sea surface), the apex, and the center of mass when it crashes onto the opponent */
  B: THREE.Vector3;
  apex: THREE.Vector3;
  land: THREE.Vector3;
}

/** The whale's swimming state: when on, every frame applies the center of mass p to the shell */
interface Swim {
  on: boolean;
  p: THREE.Vector3;
  /** Advance along the path (u: 0 to 1); when path is null, p is used directly */
  u: number;
  path: ((u: number, out: THREE.Vector3) => THREE.Vector3) | null;
}

interface Mem {
  g?: Geo;
  tide: number;
  moonpull: boolean;
  layers: FxLayer[];
  swim: Swim;
  night?: Night;
  sea?: Sea;
  lens?: Lens;
  moon?: Moon;
  mats: THREE.Material[];
  /** The stretch where the whale song is still sounding: yielded when the next stretch begins */
  voice?: SampleVoice | null;
  /** The two water crowns of the breach and the impact */
  crowns?: { B: Crown; F: Crown };
  /** Already back in place (done only once after a miss or a block) */
  homeBound?: boolean;
  unreg?: () => void;
}

function mem(c: UltCtx): Mem {
  if (!c.mem.ths) {
    const me = c.view.sides[c.side];
    const marks = me.team[me.active]?.marks ?? [];
    const tide = marks.find((x) => x.id === 'kit:tide')?.n ?? 0;
    const moonpull = marks.some((x) => x.id === 'fx:thalassene_moonpull');
    c.mem.ths = { tide: Math.max(0, Math.min(3, tide)), moonpull, layers: [], swim: { on: false, p: new THREE.Vector3(), u: 0, path: null }, mats: [] } as Mem;
  }
  return c.mem.ths as Mem;
}
const creature = (c: UltCtx) => c.sc.slots[c.side].creature;
/** The whale's action weights (only effective on the experimental model) */
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

function geometry(c: UltCtx): Geo {
  const { sc, side, foe, cine } = c;
  const m = mem(c);
  const cr = creature(c);
  const fc = sc.slots[foe].creature;
  const h = cr?.worldHeight ?? 1.8;
  const hf = fc?.worldHeight ?? 1.5;
  const s = cr ? cr.scaler.scale.y * cr.root.scale.y : 1;
  const home = sc.slots[side].home.clone().setY(0);
  const foeHome = sc.slots[foe].home.clone().setY(0);
  const f = cine.forward(side);
  const a = cine.orbitPos(side, new THREE.Vector3(), 90, 1, 0).setY(0).normalize();
  const yaw = cr ? cr.root.rotation.y : Math.atan2(f.x, f.z);
  const hover0 = cr?.hover ?? 0;
  // Center of mass: the model's core anchor converted back to body coordinates; the legacy model uses half the body height
  let piv = new THREE.Vector3(0, (h * 0.45) / s, 0);
  if (cr?.anchor('core')) {
    const w = anchorPos(c, 'core', () => home.clone());
    cr.body.updateMatrixWorld(true);
    piv = cr.body.worldToLocal(w.clone());
    piv.y += hover0;
  }
  const rest = home.clone().add(new THREE.Vector3(piv.x, 0, piv.z).applyAxisAngle(UP, yaw).multiplyScalar(s)).setY((piv.y + hover0) * s);
  const snout = anchorPos(c, 'snout', () => rest.clone().addScaledVector(f, h * 0.7));
  const tail = anchorPos(c, 'fluke', () => rest.clone().addScaledVector(f, -h * 0.9));
  const len = Math.max(h, snout.distanceTo(tail));
  const sea = THREE.MathUtils.clamp(hf * 0.26, 0.35, 0.6);
  const float = rest.clone().setY(sea + 0.075 * len);
  const D = home.distanceTo(foeHome);
  const bd = THREE.MathUtils.clamp(hf * 0.5 + (fc?.width ?? 1) * 0.3 + 1.2, 1.9, D * 0.42);
  const B = foeHome.clone().addScaledVector(f, -bd).setY(sea);
  const apex = B.clone().addScaledVector(f, 0.25).setY(sea + len * 0.66 + 0.15);
  const land = foeHome.clone().addScaledVector(f, -0.15).setY(hf * 0.85 + len * 0.12);
  const leftW = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, yaw);
  const rollSign = leftW.dot(a) > 0 ? 1 : -1;
  void m;
  return { h, hf, s, piv, hover0, yaw, rollSign, f, a, home, foe: foeHome, len, sea, rest, float, B, apex, land };
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

// ───────────────────────── Swim layer ─────────────────────────

/** Every frame applies the world position of the center of mass to the shell: the horizontal part goes to root (height stays at 0), the vertical part goes to hover */
function swimLayer(c: UltCtx): void {
  const m = mem(c);
  const cr = creature(c);
  if (!cr) return;
  const off = new THREE.Vector3();
  const layer = c.sc.vfx.layer(new THREE.Object3D(), () => {
    const sw = m.swim;
    const g = m.g;
    if (!sw.on || !g) return;
    if (sw.path) sw.path(sw.u, sw.p);
    off.set(g.piv.x, 0, g.piv.z).applyAxisAngle(UP, g.yaw).multiplyScalar(g.s);
    cr.root.position.set(sw.p.x - off.x, 0, sw.p.z - off.z);
    cr.hover = sw.p.y / g.s - g.piv.y;
  });
  m.layers.push(layer);
}

/** Path from a to b: eh tweens the horizontal and ev the vertical, and the middle section can arch by arc */
function lineTo(a: THREE.Vector3, b: THREE.Vector3, eh: (x: number) => number, ev: (x: number) => number, arc = 0) {
  const A = a.clone();
  const Bv = b.clone();
  return (u: number, out: THREE.Vector3) => {
    const kh = eh(clamp01(u));
    const kv = ev(clamp01(u));
    out.set(A.x + (Bv.x - A.x) * kh, A.y + (Bv.y - A.y) * kv + Math.sin(Math.PI * clamp01(u)) * arc, A.z + (Bv.z - A.z) * kh);
    return out;
  };
}

// ───────────────────────── Moonlit night ─────────────────────────

interface Atmos {
  sky: THREE.Color[];
  stars: number;
  fog: THREE.Color;
  ambient: THREE.Color;
  rim: THREE.Color;
  shadow: THREE.Color;
  hemi: THREE.Color;
  hemiGround: THREE.Color;
  hemiI: number;
  sunColor: THREE.Color;
  sunI: number;
}
interface Night {
  k: number;
  tick: FxLayer;
  restore(): void;
}

/** Atmosphere of the moonlit night: deep blue sky, a trace of blue light on the horizon, moonlight coming in along the outlines (the tint is no darker than 0x7c82c6) */
const MOON_ATMOS = {
  sky: [0x070d2c, 0x16225a, 0x2c3d7c],
  fog: 0x1c2a5e,
  ambient: 0x8290d0,
  rim: 0xd0e6ff,
  shadow: 0x3a4aa0,
  hemi: 0x5a70c0,
  hemiGround: 0x1a2450,
  sunColor: 0xb8c8ff,
};

/**
 * The sky turns to a moonlit night: record the daytime sky, fog and lighting (on the first call), with k deciding the depth of the night; the arena effects pause rewriting the atmosphere (fieldFx.hold).
 * Transparent, additive light effects in the arena and arena effects (the lighthouse beam, rain, light specks) are hidden at night and put back at wrap-up.
 */
function makeNight(c: UltCtx): Night {
  const { sc } = c;
  const A = sc.arena;
  const u = A.skyMat.uniforms;
  const day: Atmos = {
    sky: [(u.top.value as THREE.Color).clone(), (u.mid.value as THREE.Color).clone(), (u.bot.value as THREE.Color).clone()],
    stars: u.uStars.value as number,
    fog: A.fog.color.clone(),
    ambient: LIGHT.ambient.value.clone(),
    rim: LIGHT.rimColor.value.clone(),
    shadow: LIGHT.shadowTint.value.clone(),
    hemi: A.hemi.color.clone(),
    hemiGround: A.hemi.groundColor.clone(),
    hemiI: A.hemi.intensity,
    sunColor: A.sun.color.clone(),
    sunI: A.sun.intensity,
  };
  const N = {
    sky: MOON_ATMOS.sky.map((x) => new THREE.Color(x)),
    fog: new THREE.Color(MOON_ATMOS.fog),
    ambient: new THREE.Color(MOON_ATMOS.ambient),
    rim: new THREE.Color(MOON_ATMOS.rim),
    shadow: new THREE.Color(MOON_ATMOS.shadow),
    hemi: new THREE.Color(MOON_ATMOS.hemi),
    hemiGround: new THREE.Color(MOON_ATMOS.hemiGround),
    sunColor: new THREE.Color(MOON_ATMOS.sunColor),
  };
  // Transparent, additive light effects: lighthouse beam, rain, glow (sprites and points count too)
  const hidden: THREE.Object3D[] = [];
  const scan = (o: THREE.Object3D) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat || Array.isArray(mat) || !o.visible) return;
    if (mat.transparent || mat.blending !== THREE.NormalBlending || (o as THREE.Sprite).isSprite || (o as THREE.Points).isPoints) hidden.push(o);
  };
  A.group.traverse(scan);
  (sc.fieldFx as unknown as { group?: THREE.Group }).group?.traverse(scan);
  sc.fieldFx.hold = true;
  sc.fieldFx.holdFx = true;
  let applied = -1;
  const apply = (k: number) => {
    (u.top.value as THREE.Color).lerpColors(day.sky[0], N.sky[0], k);
    (u.mid.value as THREE.Color).lerpColors(day.sky[1], N.sky[1], k);
    (u.bot.value as THREE.Color).lerpColors(day.sky[2], N.sky[2], k);
    u.uStars.value = k > 0.4 ? 1 : day.stars;
    A.fog.color.lerpColors(day.fog, N.fog, k);
    LIGHT.ambient.value.lerpColors(day.ambient, N.ambient, k);
    LIGHT.rimColor.value.lerpColors(day.rim, N.rim, k);
    LIGHT.shadowTint.value.lerpColors(day.shadow, N.shadow, k);
    A.hemi.color.lerpColors(day.hemi, N.hemi, k);
    A.hemi.groundColor.lerpColors(day.hemiGround, N.hemiGround, k);
    A.hemi.intensity = THREE.MathUtils.lerp(day.hemiI, day.hemiI * 0.55, k);
    A.sun.color.lerpColors(day.sunColor, N.sunColor, k);
    A.sun.intensity = THREE.MathUtils.lerp(day.sunI, day.sunI * 0.45, k);
  };
  const night: Night = {
    k: 0,
    tick: sc.vfx.layer(new THREE.Object3D(), () => {
      if (night.k !== applied) {
        applied = night.k;
        apply(night.k);
      }
      // The arena effects set their own light shells back to visible every frame: hide them once the night is deep enough
      const hide = night.k > 0.3;
      for (const o of hidden) o.visible = !hide;
    }),
    restore() {
      night.tick.kill();
      if (!sc.disposed) apply(0);
      else {
        LIGHT.ambient.value.copy(day.ambient);
        LIGHT.rimColor.value.copy(day.rim);
        LIGHT.shadowTint.value.copy(day.shadow);
      }
      for (const o of hidden) o.visible = true;
      sc.fieldFx.hold = false;
      sc.fieldFx.holdFx = false;
    },
  };
  return night;
}

// ───────────────────────── Sea ─────────────────────────

interface Ring {
  /** Center (xz), current radius, amplitude (0 is off), width */
  c: THREE.Vector2;
  r: number;
  amp: number;
  w: number;
}
interface Sea {
  level: number;
  chop: number;
  /** The mound of water swelling on the sea surface (before the breach) */
  mound: number;
  moundC: THREE.Vector2;
  moundR: number;
  /** The high wave pushing outward and the tide ring closing inward */
  surge: Ring;
  ebb: Ring;
  /** The wake of the submerged cruise: head position, direction, strength */
  wake: { p: THREE.Vector2; d: THREE.Vector2; k: number; len: number };
  /** Ripples of the whale song */
  song: { c: THREE.Vector2; k: number };
  /** The light path of the moonlight */
  moon: THREE.Vector2;
  moonAmt: number;
  /** Sea surface height at a point (the same function as the mesh) */
  height(x: number, z: number): number;
  kill(): void;
}

/**
 * The sea that fills the whole arena: an opaque polar-coordinate mesh with the outline layer on (dense at the center, sparse on the outer ring, the outer edge reaching the sky dome), with swells and normals computed on the CPU every frame,
 * so the outline shows the waterline where the sea meets the spirits and props. The shading is its own cartoon sea: a three-step sea color, the sky color reflected when looking along the surface, white foam on the wave crests and the wake,
 * the light path and glitter the moonlight draws on the sea, and the ripples around the spirits.
 */
function makeSea(c: UltCtx, center: THREE.Vector3): Sea {
  const { sc } = c;
  const lo = low(c);
  const NR = lo ? 44 : 84;
  const NA = lo ? 72 : 128;
  const RMAX = 170;
  const nv = 1 + NR * NA;
  const pos = new Float32Array(nv * 3);
  const base = new Float32Array(nv * 2);
  const fade = new Float32Array(nv);
  base[0] = center.x;
  base[1] = center.z;
  fade[0] = 1;
  for (let i = 1; i <= NR; i++) {
    const r = RMAX * Math.pow(i / NR, 2.2);
    for (let j = 0; j < NA; j++) {
      const k = 1 + (i - 1) * NA + j;
      const th = (j / NA) * TAU;
      base[k * 2] = center.x + Math.cos(th) * r;
      base[k * 2 + 1] = center.z + Math.sin(th) * r;
      fade[k] = THREE.MathUtils.smoothstep(r, 60, 22);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < NA; j++) idx.push(0, 1 + ((j + 1) % NA), 1 + j);
  for (let i = 1; i < NR; i++)
    for (let j = 0; j < NA; j++) {
      const a = 1 + (i - 1) * NA + j;
      const b = 1 + (i - 1) * NA + ((j + 1) % NA);
      const a2 = a + NA;
      const b2 = b + NA;
      idx.push(a, b, a2, b, b2, a2);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(center.clone(), RMAX);
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uL: LIGHT.dir,
      uDeep: { value: new THREE.Color(0x0b2766) },
      uMid: { value: new THREE.Color(0x1a4c9e) },
      uHi: { value: new THREE.Color(0x3478c6) },
      uSky: { value: new THREE.Color(0x3c5aa6) },
      uFoam: { value: new THREE.Color(0xeaf6ff) },
      uEye: { value: new THREE.Vector2() },
      uMoon: { value: new THREE.Vector2() },
      uMoonAmt: { value: 0 },
      uSurge: { value: new THREE.Vector4(0, 0, 0, 0) },
      uEbb: { value: new THREE.Vector4(0, 0, 0, 0) },
      uWake: { value: new THREE.Vector4(0, 0, 1, 0) },
      uWakeK: { value: new THREE.Vector2(0, 4) },
      uRip0: { value: new THREE.Vector4(0, 0, 1, 0) },
      uRip1: { value: new THREE.Vector4(0, 0, 1, 0) },
      uSong: { value: new THREE.Vector3(0, 0, 0) },
      uChop: { value: new THREE.Vector3(center.x, center.z, 0.8) },
      uCrest: { value: 0.16 },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uLevel;
      varying vec3 vW; varying vec3 vN; varying float vH;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vH = wp.y - uLevel;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uL;
      uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uHi; uniform vec3 uSky; uniform vec3 uFoam;
      uniform vec2 uEye; uniform vec2 uMoon; uniform float uMoonAmt;
      uniform vec4 uSurge; uniform vec4 uEbb; uniform vec4 uWake; uniform vec2 uWakeK;
      uniform vec4 uRip0; uniform vec4 uRip1; uniform vec3 uSong; uniform vec3 uChop; uniform float uCrest;
      varying vec3 vW; varying vec3 vN; varying float vH;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // A ripple line spreading outward (d is the distance to the center, r0 is the starting radius)
      float ripple(vec2 c, float r0, float amt, float speed, float spacing) {
        if (amt <= 0.0) return 0.0;
        float d = length(vW.xz - c) - r0;
        if (d < 0.0) return 0.0;
        float w = fract(d / spacing - uTime * speed);
        return smoothstep(0.1, 0.0, abs(w - 0.5) - 0.42) * smoothstep(spacing * 2.2, 0.0, d) * amt;
      }
      float ringFoam(vec4 R) {
        if (R.w <= 0.0) return 0.0;
        float d = length(vW.xz - R.xy) - R.z;
        return smoothstep(0.3, 0.08, abs(d + 0.05)) * R.w + smoothstep(0.9, 0.3, abs(d + 0.7)) * R.w * 0.18;
      }
      void main(){
        // Fine wave slopes are computed per pixel (the same sines as the CPU displacement), while the normals of the large swells (water mounds, tide rings, wakes) come from the vertices: a sparse distant mesh still does not show squares
        float t = uTime;
        float fd = smoothstep(60.0, 22.0, length(vW.xz - uChop.xy)) * uChop.z;
        float c3 = cos((vW.x + vW.z) * 0.45 + t * 0.9) * 0.0315;
        float sx = (cos(vW.x * 0.9 + t * 1.7) * 0.0405 + c3) * fd;
        float sz = (cos(vW.z * 1.1 - t * 1.3) * 0.044 + c3) * fd;
        vec3 N = normalize(normalize(vN) + vec3(-sx, 0.0, -sz) * 1.2);
        vec3 V = normalize(cameraPosition - vW);
        vec3 Ld = normalize(uL);
        float dn = dot(N, Ld) - Ld.y;
        // Three-step sea color: the lit calm surface is the midtone, wave faces turned away from the light are dark and wave faces turned toward it are bright
        vec3 col = mix(uMid, uDeep, smoothstep(-0.05, -0.07, dn));
        col = mix(col, uHi, smoothstep(0.045, 0.065, dn));
        // At grazing angles the sea reflects the sky color (the distant sea blends into the sky)
        float graze = pow(max(1.0 - abs(V.y), 0.0), 4.0);
        col = mix(col, uSky, graze * 0.6);
        float foam = 0.0;
        // Wave crests: only the tallest line is white (the threshold rises with big waves)
        foam += smoothstep(uCrest, uCrest + 0.05, vH);
        // Tall waves pushed outward, tide rings drawn inward
        foam += ringFoam(uSurge) + ringFoam(uEbb);
        // Wake of the submerged cruise: two white V-shaped waves behind the head with churning foam between them
        if (uWakeK.x > 0.0) {
          vec2 rel = vW.xz - uWake.xy;
          float along = -dot(rel, uWake.zw);
          float perp = abs(rel.x * uWake.w - rel.y * uWake.z);
          float inLen = smoothstep(-0.3, 0.2, along) * smoothstep(uWakeK.y, uWakeK.y * 0.6, along);
          float v = smoothstep(0.28, 0.08, abs(perp - along * 0.36 - 0.35)) * inLen;
          float churn = smoothstep(0.6, 0.2, perp) * inLen * step(0.45, hash(floor(vW.xz * 3.0) + floor(uTime * 12.0) * 0.21));
          foam += (v + churn + smoothstep(0.9, 0.2, length(rel)) ) * uWakeK.x;
        }
        // Ripples around the spirit, and the ripples the whale song sends out from beneath the whale
        foam += ripple(uRip0.xy, uRip0.z, uRip0.w, 0.5, 0.7) * 0.35 + ripple(uRip1.xy, uRip1.z, uRip1.w, 0.5, 0.6) * 0.3;
        foam += ripple(uSong.xy, 0.8, uSong.z, 1.6, 1.3);
        col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
        // Moonlight glitter path: a bright band from the camera toward the moon that widens with distance, with sparkles flickering on it
        if (uMoonAmt > 0.0) {
          vec2 dir = normalize(uMoon - uEye + vec2(1e-4));
          vec2 rel = vW.xz - uEye;
          float along = dot(rel, dir);
          float perp = abs(rel.x * dir.y - rel.y * dir.x);
          float path = exp(-perp * perp / (0.4 + max(along, 0.0) * 0.12)) * smoothstep(0.0, 3.0, along) * uMoonAmt;
          // Sparkles: small horizontally stretched bright dots in a fine grid, flickering randomly (the whole cell is not filled bright)
          vec2 gq = vW.xz * 4.0;
          vec2 gi = floor(gq);
          vec2 gf = fract(gq) - 0.5;
          vec2 go = vec2(hash(gi + 1.7), hash(gi + 5.3)) * 0.5 - 0.25;
          float gl = length(vec2(dot(gf - go, vec2(dir.y, -dir.x)) * 0.8, dot(gf - go, dir) * 3.0));
          float glit = step(0.72, hash(gi + floor(uTime * 5.0) * 0.37)) * smoothstep(0.16, 0.08, gl);
          col = mix(col, vec3(0.78, 0.88, 1.0), path * 0.3);
          col = mix(col, vec3(0.95, 0.98, 1.0), min(1.0, path * 1.3) * glit);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.layers.enable(INK_LAYER);
  mesh.userData.inkScene = true;
  mesh.visible = false;
  registerInkRoot(mesh);
  const U = mat.uniforms;
  const sea: Sea = {
    level: -0.5,
    chop: 0.8,
    mound: 0,
    moundC: new THREE.Vector2(),
    moundR: 2,
    surge: { c: new THREE.Vector2(), r: 0, amp: 0, w: 0.9 },
    ebb: { c: new THREE.Vector2(), r: 0, amp: 0, w: 0.6 },
    wake: { p: new THREE.Vector2(), d: new THREE.Vector2(1, 0), k: 0, len: 4 },
    song: { c: new THREE.Vector2(), k: 0 },
    moon: new THREE.Vector2(),
    moonAmt: 0,
    height: (x, z) => hgt(x, z, 1),
    kill: () => layer.kill(),
  };
  let time = 0;
  const ringH = (R: Ring, x: number, z: number): number => {
    if (R.amp === 0) return 0;
    const d = Math.hypot(x - R.c.x, z - R.c.y) - R.r;
    const q = d / R.w;
    return R.amp * (Math.exp(-q * q) - 0.35 * Math.exp(-(q + 1.6) * (q + 1.6)));
  };
  const hgt = (x: number, z: number, fd: number): number => {
    const t = time;
    return sea.level + sea.chop * fd * (Math.sin(x * 0.9 + t * 1.7) * 0.045 + Math.sin(z * 1.1 - t * 1.3) * 0.04 + Math.sin((x + z) * 0.45 + t * 0.9) * 0.07) + big(x, z);
  };
  /** Large swells: the mound of water, the tide ring, the wake (normals are computed only from these; the fine waves' normals are computed per pixel in the shader) */
  const big = (x: number, z: number): number => {
    let y = 0;
    if (sea.mound) {
      const dx = x - sea.moundC.x;
      const dz = z - sea.moundC.y;
      y += sea.mound * Math.exp(-(dx * dx + dz * dz) / (sea.moundR * sea.moundR));
    }
    y += ringH(sea.surge, x, z) + ringH(sea.ebb, x, z);
    if (sea.wake.k) {
      const rx = x - sea.wake.p.x;
      const rz = z - sea.wake.p.y;
      const along = rx * sea.wake.d.x + rz * sea.wake.d.y;
      const perp = rx * sea.wake.d.y - rz * sea.wake.d.x;
      y += sea.wake.k * 0.16 * Math.exp(-(along * along) / 1.2 - (perp * perp) / 0.35);
    }
    return y;
  };
  const layer = sc.vfx.layer(mesh, (dt) => {
    time += dt;
    mesh.visible = sea.level > -0.45;
    if (!mesh.visible) return;
    for (let k = 0; k < nv; k++) {
      const x = base[k * 2];
      const z = base[k * 2 + 1];
      pos[k * 3] = x;
      pos[k * 3 + 1] = hgt(x, z, fade[k]);
      pos[k * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
    const nrm = geo.attributes.normal as THREE.BufferAttribute;
    const na = nrm.array as Float32Array;
    const anyBig = sea.mound !== 0 || sea.surge.amp !== 0 || sea.ebb.amp !== 0 || sea.wake.k !== 0;
    const e = 0.12;
    for (let k = 0; k < nv; k++) {
      let nx = 0;
      let nz = 0;
      if (anyBig) {
        const x = base[k * 2];
        const z = base[k * 2 + 1];
        nx = -(big(x + e, z) - big(x - e, z)) / (2 * e);
        nz = -(big(x, z + e) - big(x, z - e)) / (2 * e);
      }
      const il = 1 / Math.hypot(nx, 1, nz);
      na[k * 3] = nx * il;
      na[k * 3 + 1] = il;
      na[k * 3 + 2] = nz * il;
    }
    nrm.needsUpdate = true;
    U.uTime.value = time;
    (U.uChop.value as THREE.Vector3).z = sea.chop;
    U.uCrest.value = 0.16 + 0.75 * Math.max(sea.surge.amp, sea.ebb.amp);
    U.uLevel.value = sea.level;
    const cam = sc.stage.camera.position;
    (U.uEye.value as THREE.Vector2).set(cam.x, cam.z);
    (U.uMoon.value as THREE.Vector2).copy(sea.moon);
    U.uMoonAmt.value = sea.moonAmt;
    const setRing = (u: THREE.Vector4, R: Ring) => u.set(R.c.x, R.c.y, R.r, R.amp > 0 ? Math.min(1, R.amp * 2.5) : 0);
    setRing(U.uSurge.value as THREE.Vector4, sea.surge);
    setRing(U.uEbb.value as THREE.Vector4, sea.ebb);
    (U.uWake.value as THREE.Vector4).set(sea.wake.p.x, sea.wake.p.y, sea.wake.d.x, sea.wake.d.y);
    (U.uWakeK.value as THREE.Vector2).set(sea.wake.k, sea.wake.len);
    (U.uSong.value as THREE.Vector3).set(sea.song.c.x, sea.song.c.y, sea.song.k);
    // Ripples around the spirits: the whale (following its swimming position) and the opponent
    const wc = c.sc.slots[c.side].creature;
    const fcr = c.sc.slots[c.foe].creature;
    const g = mem(c).g;
    if (wc && g) {
      const p = mem(c).swim.on ? mem(c).swim.p : g.rest;
      const inWater = Math.abs(p.y - sea.level) < g.len * 0.25 ? 1 : 0;
      (U.uRip0.value as THREE.Vector4).set(p.x, p.z, g.len * 0.32, inWater);
    }
    // After the opponent has fallen and been put away there are no more ripples
    const foeOn = !!fcr && fcr.root.visible && fcr.root.scale.y > 0.2;
    if (fcr) (U.uRip1.value as THREE.Vector4).set(fcr.root.position.x, fcr.root.position.z, Math.max(0.35, fcr.width * 0.4), foeOn ? 1 : 0);
  }, () => {
    geo.dispose();
    mat.dispose();
  });
  mem(c).layers.push(layer);
  return sea;
}

// ───────────────────────── Water on the camera ─────────────────────────

interface Lens {
  amt: number;
  /** A water level raised only for the camera: when a wave hits the camera it submerges the camera entirely (the sea surface in the scene is unchanged) */
  flood: number;
  bubbles: number;
  drops: number;
  kill(): void;
}

/**
 * Camera overlay: the part of the view below the sea surface gets a layer of blue, a caustic net, light shafts and rising bubbles; the waterline is right in front of the camera and rises and falls with the waves.
 * After surfacing, the droplets hanging on the camera slowly slide down and fade. The water level takes the sea surface height at the camera's position (the same function as the sea's mesh).
 */
function makeLens(c: UltCtx, sea: Sea): Lens {
  const { sc } = c;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uInvPV: { value: new THREE.Matrix4() },
      uCam: { value: new THREE.Vector3() },
      uLevel: { value: -1 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uAmt: { value: 1 },
      uBubbles: { value: 0 },
      uDrops: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform mat4 uInvPV; uniform vec3 uCam; uniform float uLevel; uniform float uTime; uniform float uAspect; uniform float uAmt; uniform float uBubbles; uniform float uDrops;
      varying vec2 vNdc;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec4 far = uInvPV * vec4(vNdc, 1.0, 1.0);
        vec3 dir = normalize(far.xyz / far.w - uCam);
        float dy = uLevel - uCam.y;
        // The waterline sits 0.3 in front of the camera: pixels whose line of sight breaks the surface there are above the water; plus the wave disturbance
        float wob = sin(vNdc.x * 4.0 * uAspect + uTime * 2.6) * 0.006 + sin(vNdc.x * 9.0 * uAspect - uTime * 4.1) * 0.003;
        float s = dy - dir.y * 0.3 + wob;
        float gate = smoothstep(0.0, 0.02, dy);
        float under = smoothstep(-0.006, 0.006, s) * gate;
        float meniscus = exp(-abs(s) * 70.0) * 0.6 * gate;
        vec2 q = vec2(vNdc.x * uAspect, vNdc.y);
        float ca = sin(q.x * 5.5 + uTime * 1.1) * sin(q.y * 6.0 - uTime * 0.9) + sin((q.x + q.y) * 3.5 + uTime * 0.7);
        float net = smoothstep(0.85, 1.5, ca);
        float ray = pow(max(0.5 + 0.5 * sin(q.x * 3.0 + uTime * 0.35 + sin(q.y * 2.0) * 0.6), 0.0), 9.0) * smoothstep(-1.0, 1.0, vNdc.y);
        float depth = clamp(s * 2.5, 0.0, 1.0);
        vec3 tint = mix(vec3(0.07, 0.24, 0.55), vec3(0.02, 0.08, 0.26), depth);
        vec3 col = tint + vec3(0.55, 0.9, 1.0) * (net * 0.36 + ray * 0.26);
        float bub = 0.0;
        if (uBubbles > 0.0) {
          vec2 g = vec2(q.x * 3.0, q.y * 3.0 - uTime * 1.4);
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          float h = hash(id);
          vec2 o = vec2(h - 0.5, hash(id + 7.0) - 0.5) * 0.6;
          float r = 0.04 + h * 0.07;
          float d = length(f - o);
          bub = (smoothstep(r, r - 0.012, d) - smoothstep(r - 0.02, r - 0.035, d)) * step(0.35, h) * uBubbles;
        }
        col += vec3(0.7, 0.95, 1.0) * bub * 0.6;
        float alpha = under * (0.5 + depth * 0.32);
        col = mix(col, vec3(0.9, 0.98, 1.0), meniscus);
        alpha = max(alpha, meniscus * 0.85);
        alpha = max(alpha, bub * under * 0.5);
        if (uDrops > 0.0) {
          vec2 g = vec2(q.x * 4.0, q.y * 4.0 + (1.0 - uDrops) * 0.6);
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          float h = hash(id + 3.0);
          vec2 o = vec2(hash(id + 11.0) - 0.5, hash(id + 5.0) - 0.5) * 0.7;
          float r = 0.03 + h * 0.05;
          float d = length((f - o) * vec2(1.0, 1.3));
          float drop = (smoothstep(r, r - 0.01, d) - smoothstep(r - 0.015, r - 0.03, d)) * step(0.55, h) * uDrops * (1.0 - under);
          col = mix(col, vec3(0.85, 0.95, 1.0), drop);
          alpha = max(alpha, drop * 0.45);
        }
        gl_FragColor = vec4(col, alpha * uAmt);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  const l: Lens = { amt: 1, flood: 0, bubbles: 0, drops: 0, kill: () => layer.kill() };
  const u = mat.uniforms;
  mesh.onBeforeRender = (_r, _s, cam) => {
    const pc = cam as THREE.PerspectiveCamera;
    (u.uInvPV.value as THREE.Matrix4).multiplyMatrices(pc.matrixWorld, pc.projectionMatrixInverse);
    (u.uCam.value as THREE.Vector3).setFromMatrixPosition(pc.matrixWorld);
    u.uAspect.value = pc.aspect;
  };
  const layer = sc.vfx.layer(mesh, (_dt, t) => {
    const cam = sc.stage.camera.position;
    u.uTime.value = t;
    u.uLevel.value = sea.height(cam.x, cam.z) + l.flood;
    u.uAmt.value = l.amt;
    u.uBubbles.value = l.bubbles;
    u.uDrops.value = l.drops;
  }, () => {
    mesh.geometry.dispose();
    mat.dispose();
  });
  mem(c).layers.push(layer);
  return l;
}

// ───────────────────────── Full moon ─────────────────────────

interface Moon {
  /** Placed at pos with radius r; rise 0 = sunk 2.6 radii below pos (below sea level), 1 = at pos */
  place(pos: THREE.Vector3, r: number): void;
  rise: number;
  /** Brightness of the moon halo */
  halo: number;
  pos(): THREE.Vector3;
  kill(): void;
}

/**
 * A solid full moon: a pale blue-white sphere (scene material + heavy lines), a few slightly raised lunar maria on the front face, always turned toward the camera; a moon halo behind it (VFX, takes bloom).
 * Placed a few units behind the subject and rising from under the sea surface (the opaque sea surface naturally hides the part that has not yet risen).
 */
function makeMoon(c: UltCtx): Moon {
  const { sc } = c;
  const m = mem(c);
  const root = new THREE.Group();
  const body = sceneMaterial(0x9aaed8, { rim: 0.15, emissive: 0xf2f6ff, emissiveAmt: 0.78 });
  const mare = sceneMaterial(0x8ea2d0, { rim: 0.1, emissive: 0xdae4fa, emissiveAmt: 0.7 });
  m.mats.push(body, mare);
  const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), body);
  root.add(sph);
  // Lunar maria: a few pale patches of varying shape (not round dots)
  const spots: [number, number, number, number, number][] = [
    [0.22, 0.24, 0.34, 0.2, 0.5],
    [-0.28, 0.02, 0.26, 0.15, -0.4],
    [0.1, -0.38, 0.2, 0.11, 1.1],
    [0.46, -0.1, 0.1, 0.07, 0.2],
  ];
  const capGeo = new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI * 0.5);
  for (const [x, y, rx, rz, rot] of spots) {
    const n = new THREE.Vector3(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y)));
    const cap = new THREE.Mesh(capGeo, mare);
    cap.position.copy(n).multiplyScalar(0.985);
    cap.quaternion.setFromUnitVectors(UP, n).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rot));
    cap.scale.set(rx, 0.04, rz);
    root.add(cap);
  }
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.layers.enable(INK_LAYER);
      o.userData.inkScene = true;
      o.userData.inkHeavy = true;
    }
  });
  registerInkRoot(root);
  const haloMat = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0x9cc4ff).multiplyScalar(0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 });
  const halo = new THREE.Sprite(haloMat);
  const g = new THREE.Group();
  g.add(root, halo);
  g.visible = false;
  const at = new THREE.Vector3();
  let r = 1;
  const moon: Moon = {
    rise: 0,
    halo: 0.55,
    place(p, rr) {
      at.copy(p);
      r = rr;
      g.visible = true;
    },
    pos: () => g.position.clone(),
    kill: () => layer.kill(),
  };
  const layer = sc.vfx.layer(g, () => {
    g.position.copy(at).addScaledVector(UP, -r * 2.6 * (1 - ease.outCubic(clamp01(moon.rise))));
    root.scale.setScalar(r);
    root.quaternion.copy(sc.stage.camera.quaternion);
    halo.scale.setScalar(r * 5.2);
    haloMat.opacity = moon.halo * clamp01(moon.rise * 1.5);
    if (m.sea) {
      m.sea.moon.set(g.position.x, g.position.z);
    }
  }, () => {
    sph.geometry.dispose();
    capGeo.dispose();
    haloMat.dispose();
  });
  m.layers.push(layer);
  return moon;
}

/** The moon hangs far off in the camera's look direction: it appears up radii above the look-at point, and its size is about frac of the frame height */
function moonAlong(c: UltCtx, cam: THREE.Vector3, look: THREE.Vector3, far: number, frac: number, up: number, fovScale = 1): { pos: THREE.Vector3; r: number } {
  const { sc } = c;
  const dir = look.clone().sub(cam).normalize();
  const dist = cam.distanceTo(look) + far;
  const halfTan = Math.tan(THREE.MathUtils.degToRad((sc.stage.camera.fov / sc.stage.fovScale) * fovScale * 0.5));
  const r = halfTan * dist * frac;
  return { pos: cam.clone().addScaledVector(dir, dist).addScaledVector(UP, r * up), r };
}

// ───────────────────────── Water crown ─────────────────────────

interface Crown {
  /** rise 0→1 surges up, fall 0→1 collapses and sinks back into the sea */
  rise: number;
  fall: number;
  /** The base of the water crown (moving it changes its position) */
  root: THREE.Object3D;
  kill(): void;
}

/**
 * A solid water crown (the splash of a milk-crown kind): a ring of thin water wall flaring outward, with slender water tongues extending from the upper edge, each tip topped with a droplet;
 * deep blue at the bottom and lighter toward the top, the tips of the water tongues white (scene material, gem highlights, heavy lines, double-sided). Every frame the vertices are rearranged on the CPU by rise/fall;
 * on collapse the droplets at the tips are flung off and fall back into the sea, flinging small droplets and white mist at the same time.
 */
function makeCrown(c: UltCtx, center: THREE.Vector3, o: { r0: number; flare: number; H: number; teeth: number; seed: number }): Crown {
  const { sc } = c;
  const m = mem(c);
  const lo = low(c);
  const NA = lo ? 72 : 132;
  const NV = lo ? 9 : 13;
  const nv = NA * NV;
  const pos = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const idx: number[] = [];
  for (let i = 0; i < NV - 1; i++)
    for (let j = 0; j < NA; j++) {
      const a = i * NA + j;
      const b = i * NA + ((j + 1) % NA);
      idx.push(a, b, a + NA, b, b + NA, a + NA);
    }
  // Water tongues: angle (slightly uneven), length, thickness
  const n = o.teeth;
  const fing = Array.from({ length: n }, (_, i) => ({
    th: ((i + 0.5 + (hash(o.seed + i * 7.3) - 0.5) * 0.5) / n) * TAU,
    h: 0.55 + 0.45 * hash(o.seed + i * 3.1),
    w: (TAU / n) * (0.42 + 0.12 * hash(o.seed + i * 5.7)),
  }));
  // Each column's water tongue strength (0 to 1) and which tongue it belongs to
  const prof = new Float32Array(NA);
  const profH = new Float32Array(NA);
  for (let j = 0; j < NA; j++) {
    const th = (j / NA) * TAU;
    let best = 0;
    let bh = 0;
    for (const f of fing) {
      let d = Math.abs(th - f.th);
      d = Math.min(d, TAU - d);
      // Water tongues on the arc: neighboring tongues join one another, so the upper edge is a ring of wavy scalloping (sharp triangles would look like ice crystals)
      const k = d < f.w ? 0.5 + 0.5 * Math.cos((Math.PI * d) / f.w) : 0;
      if (k > best) {
        best = k;
        bh = f.h;
      }
    }
    prof[j] = best;
    profH[j] = bh;
  }
  const cLow = new THREE.Color(0x1f6cc0);
  const cMid = new THREE.Color(0x4aa8ec);
  const cTop = new THREE.Color(0xf4fbff);
  const tc = new THREE.Color();
  for (let i = 0; i < NV; i++) {
    const v = i / (NV - 1);
    for (let j = 0; j < NA; j++) {
      // A thick ring of white foam along the upper edge (the boundary undulating with the angle), saturated blue below: white crown, blue body, not like ice
      const th = (j / NA) * TAU;
      const edge = 0.66 + 0.08 * Math.sin(th * 5 + o.seed) + 0.05 * Math.sin(th * 11 + o.seed * 2.3) - 0.08 * prof[j];
      tc.copy(cLow).lerp(cMid, THREE.MathUtils.smoothstep(v, 0.15, 0.5)).lerp(cTop, THREE.MathUtils.smoothstep(v, edge, edge + 0.04));
      const k = (i * NA + j) * 3;
      col[k] = tc.r;
      col[k + 1] = tc.g;
      col[k + 2] = tc.b;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = sceneMaterial(0xffffff, { rim: 0.4, emissive: 0xbfe6ff, emissiveAmt: 0.12 });
  mat.vertexColors = true;
  mat.side = THREE.DoubleSide;
  const dropMat = sceneMaterial(0xf2faff, { rim: 0.35, emissive: 0xdff2ff, emissiveAmt: 0.25, surface: 'gem' });
  m.mats.push(mat, dropMat);
  const root = new THREE.Group();
  root.position.copy(center);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  root.add(mesh);
  const dropGeo = new THREE.SphereGeometry(1, 14, 10);
  const drops = fing.map(() => {
    const d = new THREE.Mesh(dropGeo, dropMat);
    d.frustumCulled = false;
    root.add(d);
    return { mesh: d, v: new THREE.Vector3(), free: false };
  });
  root.traverse((x) => {
    if ((x as THREE.Mesh).isMesh) {
      x.layers.enable(INK_LAYER);
      x.userData.inkScene = true;
      x.userData.inkHeavy = true;
    }
  });
  root.visible = false;
  registerInkRoot(root);
  const cr: Crown = { rise: 0, fall: 0, root, kill: () => layer.kill() };
  let flung = false;
  const P = new THREE.Vector3();
  const dropR = Math.max(0.05, o.H * 0.04);
  // The vertex at a given column and height (root coordinates)
  const at = (j: number, v: number, rise: number, fall: number, out: THREE.Vector3) => {
    const th = (j / NA) * TAU;
    const kr = ease.outBack(rise);
    const f = prof[j];
    const rimH = o.H * (0.8 + 0.2 * f * profH[j]);
    // The upper edge curls outward into a lip (the way a wave crest rolls over)
    const lip = Math.max(0, v - 0.82) / 0.18;
    // Collapse: the whole ring sinks back into the sea (the opaque sea surface swallows it), the upper edge spreading slightly outward; the water wall keeps swaying, so it looks like flowing water
    const wob = Math.sin(time * 9 + th * 3 + o.seed) * 0.035 * o.H * v * v;
    // The upper edge curls outward and down into a round lip, round-headed from the side rather than a pointed ice shard
    const y = rimH * v * kr * (1 - fall * 0.45) - fall * o.H * 0.85 + wob - lip * lip * o.H * 0.12 * rise;
    // The water wall itself is a smooth trumpet flare (the radius does not vary with the water tongues, otherwise cartoon shading would light each piece as a streak of ice-crystal facets), and only the upper edge is a wavy scallop
    const r = o.r0 + o.flare * (Math.pow(v, 1.5) * (0.3 + 0.7 * rise) + lip * lip * 0.35 * rise + fall * 0.3 * v);
    return out.set(Math.cos(th) * r, y, Math.sin(th) * r);
  };
  const tip = fing.map((f) => Math.round((f.th / TAU) * NA) % NA);
  let time = 0;
  const layer = sc.vfx.layer(root, (dt) => {
    time += dt;
    const rise = clamp01(cr.rise);
    const fall = clamp01(cr.fall);
    // On surging up, the upper edge keeps flinging spray and mist
    if (rise > 0.15 && fall < 0.3 && dt > 0) {
      const n = lo ? 1 : 3;
      for (let q = 0; q < n; q++) {
        const t = Math.floor(Math.random() * fing.length);
        at(tip[t], 1, rise, fall, P);
        root.updateMatrixWorld();
        root.localToWorld(P);
        const out = P.clone().sub(root.position).setY(0).normalize().setY(1.4).normalize();
        sc.vfx.emit({ pos: P, count: 2, color: [FOAM, CYAN_HI, 0xffffff], speed: [1, 3], dir: out, spread: 0.45, life: [0.35, 0.7], size: [0.05, 0.11], sizeEnd: 0.3, gravity: -8, drag: 0.6, intensity: 0.7 });
        if (q === 0 && Math.random() < 0.35) sc.vfx.smoke({ pos: P, count: 1, color: SPRAY, speed: [0.3, 1], dir: out, spread: 0.6, life: [0.5, 0.9], size: [0.25, 0.45], sizeEnd: 1.6, gravity: -0.4, drag: 1.2 });
      }
    }
    const wall = rise > 0.002 && fall < 0.995;
    mesh.visible = wall;
    root.visible = wall || drops.some((d) => d.free && d.mesh.visible);
    if (wall) {
      for (let j = 0; j < NA; j++)
        for (let i = 0; i < NV; i++) {
          at(j, i / (NV - 1), rise, fall, P);
          const k = (i * NA + j) * 3;
          pos[k] = P.x;
          pos[k + 1] = P.y;
          pos[k + 2] = P.z;
        }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    }
    // Droplets at the tips: topping the water tongues on surging up, flung off on collapse
    if (fall > 0.04 && !flung) {
      flung = true;
      drops.forEach((d, t) => {
        d.free = true;
        const out = d.mesh.position.clone().setY(0).normalize();
        d.v.copy(out).multiplyScalar(1.2 + hash(o.seed + t) * 1.6).setY(1.5 + hash(o.seed + t * 2.3) * 1.8);
        P.copy(d.mesh.position);
        root.updateMatrixWorld();
        root.localToWorld(P);
        sc.vfx.emit({ pos: P, count: lo ? 3 : 6, color: [FOAM, CYAN_HI, 0xffffff], speed: [1.2, 3.5], dir: out.clone().setY(0.7).normalize(), spread: 0.5, life: [0.5, 0.9], size: [0.05, 0.12], sizeEnd: 0.3, gravity: -9, drag: 0.6, intensity: 0.75 });
        if (t % 2 === 0) sc.vfx.smoke({ pos: P, count: 1, color: SPRAY, speed: [0.4, 1.2], dir: out, spread: 0.6, life: [0.6, 1.0], size: [0.3, 0.55], sizeEnd: 1.6, gravity: -0.5, drag: 1.2 });
      });
    }
    drops.forEach((d, t) => {
      if (!d.free) {
        d.mesh.visible = false;
        at(tip[t], 1, rise, fall, d.mesh.position).addScaledVector(UP, dropR * 0.7);
        d.mesh.scale.setScalar(dropR * (0.8 + 0.4 * fing[t].h) * clamp01((rise - 0.3) * 3));
      } else if (d.mesh.visible) {
        d.v.y -= 9 * dt;
        d.mesh.position.addScaledVector(d.v, dt);
        if (d.mesh.position.y < -0.1) d.mesh.visible = false;
      }
    });
  }, () => {
    geo.dispose();
    dropGeo.dispose();
  });
  m.layers.push(layer);
  return cr;
}

// ───────────────────────── Water ─────────────────────────

/** Water flung off the body: sprays a few droplets every frame from the given anchor (only when above the sea surface), for dur seconds */
function shed(c: UltCtx, names: string[], dur: number, rate: number, dir?: () => THREE.Vector3): void {
  const { sc } = c;
  const m = mem(c);
  const lo = low(c);
  let t = 0;
  let acc = 0;
  const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
    t += dt;
    if (t > dur) return layer.kill();
    acc += dt * rate * (lo ? 0.4 : 1);
    const n = Math.floor(acc);
    if (!n) return;
    acc -= n;
    const sea = m.sea;
    for (let i = 0; i < n; i++) {
      const name = names[(i + Math.floor(t * 60)) % names.length];
      const p = anchorPos(c, name, () => sc.center(c.side));
      if (sea && p.y < sea.height(p.x, p.z) + 0.05) continue;
      sc.vfx.emit({ pos: p, count: 2, color: [FOAM, CYAN_HI, 0xffffff], speed: [0.3, 1.4], dir: dir?.() ?? UP.clone().negate(), spread: 0.8, life: [0.4, 0.8], size: [0.05, 0.12], sizeEnd: 0.4, gravity: -7, drag: 0.5, intensity: 0.7, radius: 0.08 });
      if (i % 4 === 0) sc.vfx.smoke({ pos: p, count: 1, color: SPRAY, speed: [0.1, 0.5], life: [0.4, 0.8], size: [0.12, 0.26], sizeEnd: 1.4, gravity: -0.6, drag: 1.2 });
    }
  });
  m.layers.push(layer);
}

/** A splash on the sea surface: droplets bursting upward, white mist pushing outward */
function splash(c: UltCtx, at: THREE.Vector3, size: number, up = 1): void {
  const { sc } = c;
  const lo = low(c);
  const n = lo ? 0.45 : 1;
  sc.vfx.emit({ pos: at, count: Math.round(60 * size * n), color: [FOAM, CYAN_HI, 0xffffff], speed: [2 * up, 7 * up], dir: UP, spread: 0.7, life: [0.5, 1.0], size: [0.07, 0.17], sizeEnd: 0.3, radius: 0.4 * size, gravity: -9, drag: 0.6, intensity: 0.8 });
  sc.vfx.smoke({ pos: at, count: Math.round(26 * size * n), color: SPRAY, speed: [1, 3.5 * up], dir: UP, spread: 1, life: [0.6, 1.2], size: [0.3, 0.6], sizeEnd: 1.8, radius: 0.5 * size, gravity: -1, drag: 1.4 });
}

/** Blow: the blowhole sprays a column of mist and droplets that spreads upward */
function spout(c: UltCtx, amt: number): void {
  const { sc } = c;
  const lo = low(c);
  const g = mem(c).g;
  const s = g?.len ?? 3;
  const at = anchorPos(c, 'blowhole', () => sc.head(c.side));
  const n = lo ? 0.5 : 1;
  sc.vfx.smoke({ pos: at, count: Math.round(34 * amt * n), color: SPRAY, speed: [2.5 * amt, 6 * amt], dir: UP, spread: 0.22, life: [0.7, 1.3], size: [0.14, 0.3], sizeEnd: 3.2, radius: 0.03 * s, gravity: -1.2, drag: 1.1 });
  sc.vfx.emit({ pos: at, count: Math.round(40 * amt * n), color: [FOAM, CYAN_HI, 0xffffff], speed: [3 * amt, 7 * amt], dir: UP, spread: 0.3, life: [0.6, 1.1], size: [0.04, 0.1], sizeEnd: 0.4, gravity: -6, drag: 0.5, intensity: 0.75 });
}

/** A ring of additive light with its own brightness control (vfx.ring is too bright at night and washes out when close to the camera); without normal it is horizontal */
function ringFx(c: UltCtx, pos: THREE.Vector3, col: THREE.ColorRepresentation, r0: number, r1: number, dur: number, intensity = 0.8, width = 0.1, normal?: THREE.Vector3): void {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(intensity), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 72), mat);
  mesh.position.copy(pos);
  if (normal) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
  else mesh.rotation.x = -Math.PI / 2;
  void c.sc.vfx.spawn(mesh, dur, (k) => {
    mesh.scale.setScalar(Math.max(1e-3, r0 + (r1 - r0) * (1 - Math.pow(1 - k, 3))));
    mat.opacity = 1 - k * k;
  }, () => {
    mesh.geometry.dispose();
    mat.dispose();
  });
}

// ───────────────────────── Sound ─────────────────────────
// The whale song, blow, tide, fluke slap, cutting through water, breach, soaring whale song, huge whale smashing the water and waves collapsing are audio files generated by ElevenLabs; synthesized versions are used until they finish loading

function whaleSong(c: UltCtx, url: string, f0: number, f1: number, dur: number, o: { gain?: number; rate?: number; peakIn?: number } = {}): void {
  const m = mem(c);
  m.voice?.fade(0.35);
  m.voice = playOr(url, () => {
    synth.tone({ type: 'sine', f0, f1, dur, gain: 0.16, attack: dur * 0.35 });
    synth.tone({ type: 'sine', f0: f0 * 1.003, f1: f1 * 1.003, dur, gain: 0.1, attack: dur * 0.4, detune: 9 });
    synth.tone({ type: 'sine', f0: f0 * 2, f1: f1 * 2, dur: dur * 0.9, gain: 0.035, attack: dur * 0.5 });
  }, { gain: o.gain ?? 0.6, rate: o.rate, peakIn: o.peakIn });
}

// ───────────────────────── Cinematic ─────────────────────────

/** Announcement → blow → eyes open → moonrise, the sea rises → raise the fluke high and dive */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side } = c;
  const m = mem(c);
  const g = geometry(c);
  m.g = g;
  const A = act(c);
  const lo = low(c);
  const port = sc.portrait;
  const L = g.len;
  const sw = m.swim;
  // Build all of this move's solid objects first (all still hidden), and compile the shaders before the announcement
  const sea = makeSea(c, g.home.clone().lerp(g.foe, 0.5).setY(0));
  m.sea = sea;
  m.lens = makeLens(c, sea);
  const moon = makeMoon(c);
  m.moon = moon;
  moon.place(g.foe.clone().setY(-40), 1);
  const tideK = 1 + m.tide * 0.15;
  const crownB = makeCrown(c, g.B.clone().setY(g.sea - 0.05), { r0: L * 0.14, flare: L * 0.16, H: L * 0.4 * tideK, teeth: 12, seed: 3 });
  const crownF = makeCrown(c, g.foe.clone().setY(g.sea - 0.05), { r0: Math.max(0.6, g.hf * 0.34), flare: L * 0.2 * tideK, H: (g.hf * 0.72 + L * 0.16) * tideK, teeth: 13, seed: 11 });
  const crownD = makeCrown(c, g.float.clone().setY(g.sea - 0.05), { r0: L * 0.08, flare: L * 0.1, H: L * 0.2, teeth: 9, seed: 5 });
  m.crowns = { B: crownB, F: crownF };
  swimLayer(c);
  sw.p.copy(g.rest);
  sw.on = true;
  const night = makeNight(c);
  m.night = night;
  m.unreg = sc.addCleanup(() => restoreWorld(c));
  sc.stage.prewarm();

  const tl = sc.gs.timeline('world');
  const push = { k: 0 };
  // ① Announcement: three-quarter side view, slightly below the eyes shooting up at the face and tide crown, singing with eyes closed; the face is in the upper part of the frame, leaving room for the ultimate's name banner
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    synth.dropMusic();
    whaleSong(c, songUrl, 174, 261, 2.4, { gain: 0.62, rate: 0.92 });
    synth.tone({ type: 'sine', f0: 49, f1: 46, dur: 2.2, gain: 0.16, attack: 0.6 });
    const fov = port ? 1.3 : 1.12;
    void cine.look({ letterbox: 1, vignette: 0.6, desat: 0.1, tint: 0xd8e4ff, lift: 0x02060f, bloom: 0.6, fov }, 0.45, ease.outQuad);
    const eye = anchorPos(c, 'eyes', () => sc.head(side));
    const aim = () => anchorPos(c, 'eyes', () => sc.head(side)).addScaledVector(UP, -L * 0.1).addScaledVector(g.f, -L * 0.08);
    const camA = cine.orbitPos(side, eye, 60, L * 0.78, -L * 0.06);
    const camB = cine.orbitPos(side, eye, 52, L * 0.64, -L * 0.08);
    const ls = aim();
    cine.cut(camA, ls);
    ride(c, (pos, look, dt) => {
      pos.lerpVectors(camA, camB, ease.outQuad(push.k));
      ls.lerp(aim(), 1 - Math.exp(-dt * 8));
      look.copy(ls);
    });
    cine.track(() => sc.head(side), ['vig', 'radial']);
  }, [], 0);
  tl.to(push, { k: 1, duration: T.moon, ease: 'none' }, 0);
  tl.to(night, { k: 0.45, duration: T.moon, ease: 'power1.in' }, 0);
  tl.to(A, { focus: 1, duration: 0.3, ease: 'power2.out' }, 0);
  tl.to(A, { sing: 1, duration: 0.5, ease: 'power2.inOut' }, 0.04);
  tl.to(A, { glow: 0.6, duration: 0.5, ease: 'power1.inOut' }, 0.1);
  // Song: rings of sound waves rippling forward from the mouth (thin and faint, not covering the face)
  for (let i = 0; i < 3; i++)
    tl.call(() => {
      const th = anchorPos(c, 'snout', () => sc.head(side)).addScaledVector(g.f, L * (0.1 + i * 0.04));
      ringFx(c, th, i % 2 ? CYAN_HI : CYAN, L * 0.03, L * (0.12 + i * 0.03), 0.7, 0.45, 0.07, g.f);
      synth.tone({ type: 'sine', f0: [784, 1046, 1175][i], dur: 0.5, gain: 0.03 });
    }, [], 0.14 + i * 0.22);

  // ② Blow; the sea begins to rise from underground
  tl.call(() => {
    spout(c, 1);
    playOr(blowUrl, () => synth.noise({ type: 'bandpass', f0: 900, f1: 400, q: 0.7, dur: 1.2, gain: 0.25, attack: 0.05 }), { gain: 1.6 });
    void sc.vfx.glint(anchorPos(c, 'crownGem', () => sc.head(side)), CYAN_HI, 0.3 + L * 0.06, 0.5, 2.6);
    sc.rig.addTrauma(0.12);
  }, [], T.blow);
  tl.to(sea, { level: g.sea * 0.2, duration: T.moon - T.blow, ease: 'power1.in' }, T.blow);
  // ③ Eyes open
  tl.to(A, { sing: 0.3, duration: 0.16, ease: 'power2.out' }, T.open);
  tl.to(A, { glow: 1, duration: 0.3, ease: 'power2.out' }, T.open);
  tl.call(() => eyeGlint(c, CYAN_HI, 1.1), [], T.open + 0.05);

  // ④ Moonrise, the sea rises (cut): behind the whale, the camera hugging the ground at eye level; the sea rises past the camera, which floats on the waterline, and the full moon rises from the horizon
  const dolly = { k: 0 };
  tl.call(() => {
    const fov = port ? 1.3 : 1.1;
    void cine.look({ fov, vignette: 0.55, desat: 0.12, tint: MOONLIGHT, lift: 0x02061a, bloom: 0.72, roll: 0 }, 0);
    cine.track(null);
    const cam = cine.orbitPos(side, g.float, 146, L * 1.05 + 1.3, 0).setY(0.12);
    const look = g.float.clone().addScaledVector(UP, L * 0.1).addScaledVector(g.f, L * 0.1);
    const mA = moonAlong(c, cam, look, 10, m.moonpull ? 0.34 : 0.28, 1.25, fov);
    moon.place(mA.pos, mA.r);
    cine.cut(cam, look);
    let t = 0;
    let y = cam.y;
    const near = cam.clone().lerp(look, 0.22);
    const lookHi = look.clone().addScaledVector(UP, L * 0.16);
    ride(c, (pos, lk, dt) => {
      t += dt;
      // After the sea surface has risen past the camera, the camera floats just a little below the waterline (half a beat behind the waves): the lower half underwater, the upper half above the surface
      const P = cam.clone().lerp(near, ease.inOutQuad(dolly.k));
      const wy = sea.height(P.x, P.z) - 0.035;
      const ty = Math.max(wy, cam.y);
      y += (ty - y) * Math.min(1, dt * 30);
      pos.set(P.x, y, P.z).addScaledVector(g.a, Math.sin(t * 0.8) * 0.05);
      lk.copy(look).lerp(lookHi, ease.inOutQuad(dolly.k));
      c.sc.rig.roll = Math.sin(t * 0.85) * 0.025;
    });
    sea.song.c.set(g.rest.x, g.rest.z);
    playOr(surgeUrl, () => synth.noise({ type: 'lowpass', f0: 240, f1: 900, dur: 1.2, gain: 0.3, attack: 0.8 }), { gain: 0.75, peakIn: 0.3 });
    whaleSong(c, songUrl, 261, 392, 1.6, { gain: 0.42, rate: 1.12 });
    sw.path = lineTo(g.rest, g.float, ease.inOutQuad, ease.inOutQuad);
    sw.u = 0;
  }, [], T.moon);
  tl.to(night, { k: 1, duration: 0.45, ease: 'power1.out' }, T.moon);
  tl.to(sea, { level: g.sea, duration: T.flood, ease: 'power2.out' }, T.moon);
  tl.to(sw, { u: 1, duration: T.flood, ease: 'none' }, T.moon);
  tl.to(moon, { rise: 1, duration: 1.0, ease: 'none' }, T.moon);
  tl.to(sea, { moonAmt: m.moonpull ? 1.4 : 1, duration: 0.8, ease: 'power1.in' }, T.moon + 0.2);
  tl.to(sea.song, { k: 1, duration: 0.3 }, T.moon + 0.3);
  tl.to(sea.song, { k: 0, duration: 0.5 }, T.dive);
  tl.to(A, { sing: 0, duration: 0.4, ease: 'power1.inOut' }, T.moon + 0.2);

  // ⑤ Dive: head lowered and sinking forward, the fluke curled up high (the camera pushes in and tilts up along), water hanging from the fluke running down its trailing edge and sliding into the sea
  tl.call(() => {
    const deep = g.float.clone().addScaledVector(g.f, L * 0.3).setY(g.sea - L * 0.95);
    sw.path = lineTo(g.float, deep, (x) => x, (x) => Math.pow(x, 2.2));
    sw.u = 0;
    playOr(flukeUrl, () => synth.noise({ type: 'lowpass', f0: 1600, f1: 200, dur: 0.6, gain: 0.35 }), { gain: 0.95, peakIn: T.under - T.dive });
    shed(c, ['fluke', 'flukeL', 'flukeR', 'tailGem'], T.under - T.dive + 0.05, lo ? 30 : 70);
    // The head enters the water first: a small splash
    void c.wait(0.2).then(() => splash(c, anchorPos(c, 'snout', () => g.float).setY(g.sea), 0.6, 0.6));
  }, [], T.dive);
  tl.to(dolly, { k: 1, duration: T.windup - T.dive, ease: 'none' }, T.dive);
  tl.to(sw, { u: 1, duration: T.windup - T.dive, ease: 'none' }, T.dive);
  // The body is lowered about 60° and the fluke curled up another 25°: the tail stock is nearly vertical, so the ripple pattern on the fluke's underside is seen from behind (curled too far it becomes a line seen edge-on)
  tl.to(A, { dive: 0.9, duration: 0.5, ease: 'power2.inOut' }, T.dive);
  tl.to(A, { fluke: 0.5, duration: 0.36, ease: 'power2.out' }, T.dive + 0.05);
  tl.call(() => {
    const at = anchorPos(c, 'fluke', () => g.float).setY(g.sea - 0.05);
    crownD.root.position.copy(at);
    const k = sc.gs.timeline('world');
    k.to(crownD, { rise: 1, duration: 0.18, ease: 'power2.out' }, 0);
    k.to(crownD, { fall: 1, duration: 0.45, ease: 'power1.in' }, 0.22);
    k.call(() => crownD.kill(), [], 0.75);
    splash(c, at, 0.8, 0.9);
  }, [], T.under);
  tl.set({}, {}, T.windup);
  await playTimeline(tl);
}

/** Cruising submerged → breach → apex (Spring Tide Aria) → roll and crash down */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const g = m.g ?? geometry(c);
  m.g = g;
  const A = act(c);
  const lo = low(c);
  const port = sc.portrait;
  const L = g.len;
  const sw = m.swim;
  const sea = m.sea!;
  const moon = m.moon!;
  const crownB = m.crowns!.B;
  const tl = sc.gs.timeline('world');

  // ① Cruising submerged (cut): hugging the sea surface alongside it; the tide crown and dorsal fin cut through the surface, trailing a V-shaped wake
  const deep = g.B.clone().addScaledVector(g.f, -0.35).setY(g.sea - L * 0.5);
  tl.call(() => {
    playOr(rushUrl, () => synth.noise({ type: 'bandpass', f0: 300, f1: 900, q: 0.8, dur: 0.9, gain: 0.3, attack: 0.3 }), { gain: 0.9, peakIn: 0.45 });
    const p0 = sw.p.clone().setY(Math.max(sw.p.y, g.sea - L * 0.3));
    const cruise = g.sea - L * 0.04;
    const pts = [p0, p0.clone().lerp(g.B, 0.14).setY(cruise), p0.clone().lerp(g.B, 0.62).setY(cruise + L * 0.01), g.B.clone().addScaledVector(g.f, -1.1).setY(g.sea - L * 0.12), deep];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    sw.path = (u, out) => curve.getPointAt(clamp01(u), out);
    sw.u = 0;
    // Wake: the head's position follows it, and white foam is only drawn close to the sea surface
    sea.wake.d.set(g.f.x, g.f.z);
    sea.wake.len = L * 1.6;
    const wakeL = sc.vfx.layer(new THREE.Object3D(), () => {
      const head = sw.p.clone().addScaledVector(g.f, L * 0.36);
      sea.wake.p.set(head.x, head.z);
      sea.wake.k = THREE.MathUtils.smoothstep(sw.p.y, g.sea - L * 0.3, g.sea - L * 0.06) * (sw.u < 0.97 ? 1 : 0);
      if (sea.wake.k > 0.3 && Math.random() < 0.7) {
        const p = head.setY(g.sea + 0.05);
        sc.vfx.emit({ pos: p, count: lo ? 1 : 3, color: [FOAM, CYAN_HI], speed: [1, 3], dir: UP.clone().addScaledVector(g.f, 0.8), spread: 0.8, life: [0.3, 0.6], size: [0.05, 0.12], gravity: -7, drag: 0.8, intensity: 0.7, radius: 0.15 });
        if (Math.random() < 0.4) sc.vfx.smoke({ pos: p, count: 1, color: SPRAY, speed: [0.5, 1.5], dir: UP, spread: 0.8, life: [0.4, 0.8], size: [0.18, 0.35], sizeEnd: 1.6, gravity: -0.5, drag: 1.2 });
      }
    });
    m.layers.push(wakeL);
    tl.call(() => {
      wakeL.kill();
      sea.wake.k = 0;
    }, [], T.cutD);
    // Camera: audience side, diagonally behind it, hugging the sea surface and gliding forward along: the tide crown and dorsal fin cut through the surface in the foreground, the opponent growing closer ahead
    const fov = port ? 1.3 : 1.14;
    void cine.look({ fov, roll: 0, vignette: 0.5 }, 0);
    const place = (pos: THREE.Vector3, look: THREE.Vector3) => {
      const head = sw.p.clone().addScaledVector(g.f, L * 0.3).setY(g.sea);
      pos.copy(head).addScaledVector(g.f, -L * 0.85).addScaledVector(g.a, L * 0.5 + 0.4).setY(g.sea + 0.42);
      look.copy(head).addScaledVector(g.f, L * 0.9).addScaledVector(g.a, -L * 0.12).setY(g.sea + 0.2);
    };
    const P = new THREE.Vector3();
    const Lk = new THREE.Vector3();
    place(P, Lk);
    cine.cut(P, Lk);
    const mC = moonAlong(c, P, Lk, 9, m.moonpull ? 0.26 : 0.2, 1.6, fov);
    moon.place(mC.pos, mC.r);
    ride(c, (pos, look, dt) => {
      place(P, Lk);
      const k = 1 - Math.exp(-dt * 12);
      pos.lerp(P, k);
      look.lerp(Lk, k);
      pos.y = Math.max(pos.y, sea.height(pos.x, pos.z) + 0.2);
    });
  }, [], 0);
  tl.to(sw, { u: 1, duration: T.cutD, ease: 'none' }, 0);
  tl.to(A, { dive: 0, fluke: 0, duration: 0.24, ease: 'power2.out' }, 0);
  tl.to(A, { swim: 1, duration: 0.2, ease: 'power1.out' }, 0);
  tl.to(A, { dive: 0.35, duration: 0.2, ease: 'power1.in' }, T.cutD - 0.2);

  // ② Target's view (cut): behind the opponent, audience side, looking up hugging the sea surface; the sea surface swells in front of the opponent
  const aimK = { k: 0 };
  tl.call(() => {
    sw.path = null;
    sw.p.copy(g.B).setY(g.sea - L * 0.52);
    sea.moundC.set(g.B.x, g.B.z);
    sea.moundR = L * 0.3;
    const fov = port ? 1.4 : 1.24;
    void cine.look({ fov, vignette: 0.55, tint: MOONLIGHT }, 0);
    // Diagonally behind the opponent, audience side, hugging the sea surface: the opponent in one corner of the foreground, with it breaching in front of the opponent (its flank visible)
    const wf = sc.slots[foe].creature?.width ?? 1;
    const cam = g.foe.clone().addScaledVector(g.f, 0.3 + wf * 0.2).addScaledVector(g.a, 2.8 + g.hf * 0.35 + wf * 0.3).setY(g.sea + 0.38);
    const lookLow = g.B.clone().setY(g.sea + L * 0.28);
    cine.cut(cam, lookLow);
    cine.track(() => sc.head(side), ['vig', 'radial']);
    const P0 = cam.clone();
    const P1 = cam.clone().add(cam.clone().sub(g.B).setY(0).normalize().multiplyScalar(1.1)).addScaledVector(UP, 0.12);
    // The full moon is behind the whale and to one side (the side far from the opponent): at the apex only the whale's head cuts across the edge of the moon, and the whole whale's silhouette falls on the deep blue night sky, not merging into the moon
    const head = g.apex.clone().addScaledVector(UP, L * 0.42);
    const mD = moonAlong(c, P1, head, 9, m.moonpull ? 0.3 : 0.26, 0.2, fov);
    const view = head.clone().sub(P1).normalize();
    const right = new THREE.Vector3().crossVectors(view, UP).normalize();
    const foeSide = Math.sign(g.foe.clone().sub(P1).dot(right)) || 1;
    moon.place(mD.pos.addScaledVector(right, -foeSide * mD.r * 1.12), mD.r);
    let t = 0;
    const ls = lookLow.clone();
    ride(c, (pos, look, dt) => {
      t += dt;
      pos.lerpVectors(P0, P1, ease.inOutQuad(Math.min(1, t / (T.fall - T.cutD))));
      // The look-at point rises with it (at the apex it lands between the whale and the full moon)
      const want = lookLow.clone().lerp(sw.p.clone().addScaledVector(UP, L * 0.3), aimK.k);
      ls.lerp(want, 1 - Math.exp(-dt * 7));
      look.copy(ls);
    });
  }, [], T.cutD);
  tl.set(A, { breach: 1, dive: 0, swim: 0, roll: 0 }, T.cutD);
  tl.to(sea, { mound: 0.32, duration: T.erupt - T.cutD, ease: 'power2.in' }, T.cutD);

  // ③ Breach: bursting vertically out of the sea, rolling over as it goes, a ring of water crown wrapping around it and spraying upward
  tl.call(() => {
    const from = sw.p.clone();
    const to = g.apex.clone();
    sw.path = lineTo(from, to, ease.inOutQuad, (x) => 1 - (1 - x) * (1 - x) * (1 - x));
    sw.u = 0;
    sea.mound = 0;
    playOr(breachUrl, () => synth.noise({ type: 'lowpass', f0: 2400, f1: 300, dur: 0.9, gain: 0.45 }), { gain: 1 });
    synth.tone({ type: 'sine', f0: 70, f1: 40, dur: 0.6, gain: 0.3 });
    sc.rig.addTrauma(0.4);
    splash(c, g.B.clone().setY(g.sea), 1.6, 1.3);
    shed(c, ['belly', 'finL', 'finR', 'fluke', 'flukeL', 'flukeR', 'crown', 'throat'], 1.1, lo ? 50 : 130);
    void cine.pulse({ radial: 0.4 }, { radial: 0 }, 0.5);
  }, [], T.erupt);
  tl.to(sw, { u: 1, duration: T.apex - T.erupt + 0.06, ease: 'none' }, T.erupt);
  tl.to(aimK, { k: 1, duration: 0.45, ease: 'power2.out' }, T.erupt);
  // From breach to apex: the blue back and flank toward the camera, the white throat and belly turning away (moonlight coming from behind); the throat and belly only flip over during the roll and crash
  tl.to(A, { roll: -g.rollSign * 0.72, duration: 0.5, ease: 'power2.out' }, T.erupt);
  tl.to(crownB, { rise: 1, duration: 0.28, ease: 'power2.out' }, T.erupt);
  tl.to(crownB, { fall: 1, duration: 0.55, ease: 'power1.in' }, T.erupt + 0.34);

  // ④ Apex, Song of the Spring Tide: time slows, and the highest note is sung before the full moon
  tl.call(() => {
    sc.stage.slowMo(0.3, 520);
    whaleSong(c, ariaUrl, 392, 784, 1.6, { gain: 0.95, rate: 1.05 });
    const core = sw.p.clone();
    // The song's sound waves spread outward flat on the sea surface (a standing white ring in front of the moon would wash it out, so it is not used)
    ringFx(c, g.B.clone().setY(g.sea + 0.05), CYAN, L * 0.3, L * 2.2, 0.9, 0.35, 0.05);
    void c.wait(0.14).then(() => ringFx(c, g.B.clone().setY(g.sea + 0.05), CYAN_HI, L * 0.2, L * 1.6, 0.8, 0.28, 0.06));
    void sc.vfx.glint(anchorPos(c, 'crownGem', () => sc.head(side)), CYAN_HI, 0.2 + L * 0.04, 0.45, 2.2);
    cine.shock(core, 0.6, 0.6, 0.9);
    void cine.pulse({ radial: 0.45, bloom: 0.72 }, { radial: 0, bloom: 0.66 }, 0.7);
    sea.song.c.set(g.B.x, g.B.z);
    ultSfx.shing(0.75);
  }, [], T.apex);
  // The ripples' fade-out is dragged past the impact: put on another timeline, so deliver is not lengthened
  tl.call(() => {
    sc.gs.timeline('world').to(sea.song, { k: 1, duration: 0.15 }, 0).to(sea.song, { k: 0, duration: 0.8 }, 0.4);
  }, [], T.apex);
  tl.call(() => {
    const from = sw.p.clone();
    const to = g.apex.clone().addScaledVector(g.f, 0.35).addScaledVector(UP, 0.1);
    sw.path = lineTo(from, to, ease.inOutQuad, ease.outQuad);
    sw.u = 0;
  }, [], T.apex + 0.06);
  tl.to(sw, { u: 1, duration: T.fall - T.apex - 0.06, ease: 'none' }, T.apex + 0.06);
  tl.to(A, { roll: -g.rollSign * 0.3, duration: T.fall - T.apex - 0.14, ease: 'power1.in' }, T.apex + 0.14);

  // ⑤ Crash (cut): side-on, seeing the whale in midair, the arc downward and the opponent at once
  tl.call(() => {
    const from = sw.p.clone();
    sw.path = lineTo(from, g.land, (x) => x, (x) => x * x);
    sw.u = 0;
    ultSfx.swell(T.deliver - T.fall, 0.22);
    const fov = port ? 1.35 : 1.18;
    void cine.look({ fov, vignette: 0.5 }, 0);
    const top = from.clone().addScaledVector(UP, L * 0.3);
    const bot = g.foe.clone().setY(0.2);
    const M = top.clone().lerp(bot, 0.5);
    const wid = Math.hypot(top.x - bot.x, top.z - bot.z) + L * 1.1;
    const dist = fitDist(c, (top.y - bot.y) * 1.3, wid * 1.2, fov);
    const cam = M.clone().addScaledVector(g.a, dist).addScaledVector(g.f, -dist * 0.12).setY(g.sea + 1.0);
    const look = M.clone().setY(M.y * 0.9);
    cine.cut(cam, look);
    cine.track(() => g.foe.clone().setY(g.hf * 0.5), ['vig', 'radial']);
    const P1 = cam.clone().lerp(look, 0.08);
    let t = 0;
    ride(c, (pos, lk, dt) => {
      t += dt;
      pos.lerpVectors(cam, P1, ease.outQuad(Math.min(1, t / 0.6)));
      pos.y = Math.max(pos.y, sea.height(pos.x, pos.z) + 0.25);
      lk.copy(look);
    });
    shed(c, ['finL', 'finR', 'fluke', 'flukeL', 'flukeR'], 0.45, lo ? 30 : 80);
  }, [], T.fall);
  tl.to(sw, { u: 1, duration: T.deliver - T.fall, ease: 'none' }, T.fall);
  tl.to(A, { breach: 0.15, dive: 0.45, roll: g.rollSign * 1.05, duration: T.deliver - T.fall, ease: 'power1.in' }, T.fall);
  tl.set({}, {}, T.deliver);
  await playTimeline(tl);
}

// ───────────────────────── Return to place ─────────────────────────

/** Return to place from beneath the sea surface: from t0 swim back to place under the surface (0.4 s), then float up to the sea surface, blowing a column of mist at 0.9 s */
function swimHome(c: UltCtx, t0: number): void {
  const { sc } = c;
  const m = mem(c);
  const g = m.g;
  const sea = m.sea;
  if (!g || !sea) return;
  const A = act(c);
  const sw = m.swim;
  const L = g.len;
  const under = g.rest.clone().setY(g.sea - L * 0.7);
  const tl = sc.gs.timeline('world');
  tl.call(() => {
    const from = sw.p.clone();
    sw.path = lineTo(from, under, ease.inOutQuad, (x) => x);
    sw.u = 0;
  }, [], t0);
  tl.to(sw, { u: 1, duration: 0.4, ease: 'none' }, t0);
  tl.to(A, { roll: 0, dive: 0, fluke: 0, breach: 0, swim: 0.6, duration: 0.3, ease: 'power1.inOut' }, t0);
  tl.call(() => {
    sw.path = lineTo(under, g.float, (x) => x, ease.outQuad);
    sw.u = 0;
    splash(c, g.float.clone().setY(g.sea), 0.5, 0.5);
  }, [], t0 + 0.42);
  tl.to(sw, { u: 1, duration: 0.45, ease: 'none' }, t0 + 0.42);
  tl.to(A, { breach: 0.3, swim: 0, duration: 0.25, ease: 'power1.out' }, t0 + 0.42);
  tl.to(A, { breach: 0, duration: 0.4, ease: 'power1.inOut' }, t0 + 0.7);
  tl.call(() => {
    spout(c, 0.75);
    playOr(blowUrl, () => synth.noise({ type: 'bandpass', f0: 900, f1: 400, q: 0.7, dur: 1, gain: 0.2, attack: 0.05 }), { gain: 1.1 });
  }, [], t0 + 0.92);
}

/** It sinks into the sea from midair (on a miss or a block) */
function sinkAt(c: UltCtx, to: THREE.Vector3, dur: number, arc = 0): void {
  const { sc } = c;
  const m = mem(c);
  const sw = m.swim;
  const from = sw.p.clone();
  sw.path = lineTo(from, to, ease.outQuad, (x) => x * x, arc);
  sw.u = 0;
  sc.gs.timeline('world').to(sw, { u: 1, duration: dur, ease: 'none' });
}

// ───────────────────────── Impact ─────────────────────────

/** Spring tide: the whale crashes onto the opponent, the water crown surges up, a high wave pushes outward and hits the camera, submerging it; the tide ring closes in toward its place, and it floats up from its place */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe } = c;
  const m = mem(c);
  const g = m.g;
  const sea = m.sea;
  if (!g || !sea || m.homeBound) return;
  m.homeBound = true;
  void ev;
  const A = act(c);
  const lo = low(c);
  const L = g.len;
  const sw = m.swim;
  const lens = m.lens!;
  const crownF = m.crowns!.F;
  const at = g.foe.clone().setY(g.sea);

  // Crash down: hit-stop, shake, white mist and droplets bursting upward
  playOr(slamUrl, () => {
    synth.noise({ type: 'lowpass', f0: 1800, f1: 90, dur: 0.9, gain: 0.55 });
    synth.tone({ type: 'sine', f0: 80, f1: 30, dur: 0.9, gain: 0.55 });
  }, { gain: 1.15 });
  playOr(crashUrl, () => synth.noise({ type: 'lowpass', f0: 2400, f1: 300, dur: 1.6, gain: 0.35, attack: 0.1 }), { gain: 0.85, delay: 0.2 });
  synth.tone({ type: 'sine', f0: 62, f1: 28, dur: 1.2, gain: 0.4 });
  sc.stage.hitStop(120);
  sc.rig.addTrauma(0.95);
  sc.stage.chromatic(0.5);
  cine.shock(sc.center(foe), 0.9, 0.6, 1);
  void cine.pulse({ radial: 0.6 }, { radial: 0 }, 0.6);
  splash(c, at, 2.6, 1.7);
  // What is already visible at the instant of the hit-stop: a ball of white light at the point of contact, the water crown already surging up a little
  void sc.vfx.flash(sc.center(foe), CYAN_HI, Math.min(1.2 + g.hf, sc.stage.camera.position.distanceTo(sc.center(foe)) * 0.3), 0.3);
  crownF.rise = 0.12;
  sc.vfx.smoke({ pos: at.clone().addScaledVector(UP, g.hf * 0.5), count: lo ? 16 : 40, color: SPRAY, speed: [3, 8], dir: UP, spread: 0.9, life: [0.8, 1.5], size: [0.5, 1.0], sizeEnd: 2.2, radius: g.hf * 0.4, gravity: -1.2, drag: 1.3 });
  ringFx(c, at.clone().setY(g.sea + 0.08), FOAM, g.hf * 0.4, L * 1.4, 0.55, 0.7, 0.08);
  void sc.vfx.glint(sc.center(foe), CYAN_HI, 0.8 + g.hf * 0.2, 0.4, 2.5);

  const tl = sc.gs.timeline('world');
  // Water crown
  tl.to(crownF, { rise: 1, duration: 0.3, ease: 'power2.out' }, 0);
  tl.to(crownF, { fall: 1, duration: 0.75, ease: 'power1.in' }, 0.55);
  tl.call(() => crownF.kill(), [], 1.4);
  // It sinks into the sea
  tl.call(() => sinkAt(c, g.foe.clone().addScaledVector(g.f, L * 0.2).setY(g.sea - L * 0.75), 0.36), [], 0);
  tl.to(A, { roll: g.rollSign * 1.3, dive: 0.8, breach: 0, duration: 0.36, ease: 'power1.in' }, 0);
  shed(c, ['fluke', 'flukeL', 'flukeR'], 0.3, lo ? 30 : 80, () => UP.clone());

  // The high wave pushes outward: hits the camera at 0.26 s
  const cam0 = sc.stage.camera.position.clone();
  const camD = Math.max(3, Math.hypot(cam0.x - at.x, cam0.z - at.z));
  const r0 = Math.max(0.6, g.hf * 0.32) + L * 0.15;
  sea.surge.c.set(at.x, at.z);
  sea.surge.w = 0.9;
  let t = 0;
  const toCam = Math.atan2(cam0.z - at.z, cam0.x - at.x);
  const surgeL = sc.vfx.layer(new THREE.Object3D(), (dt) => {
    t += dt;
    const R = t < 0.26 ? r0 + (camD - r0) * (t / 0.26) : camD + (t - 0.26) * 8;
    sea.surge.r = R;
    sea.surge.amp = 0.95 * THREE.MathUtils.smoothstep(t, 0, 0.06) * (1 - THREE.MathUtils.smoothstep(t, 0.3, 1.4));
    // Spray flung from the wave crest (the part toward the camera)
    if (sea.surge.amp > 0.3 && R < camD * 0.92) {
      for (let i = 0; i < (lo ? 1 : 3); i++) {
        const th = toCam + (Math.random() - 0.5) * 1.7;
        const p = new THREE.Vector3(at.x + Math.cos(th) * R, 0, at.z + Math.sin(th) * R);
        p.y = sea.height(p.x, p.z) + 0.04;
        const out = new THREE.Vector3(Math.cos(th), 1.3, Math.sin(th)).normalize();
        sc.vfx.emit({ pos: p, count: 2, color: [FOAM, CYAN_HI, 0xffffff], speed: [1.5, 4], dir: out, spread: 0.4, life: [0.35, 0.7], size: [0.06, 0.14], sizeEnd: 0.3, gravity: -8, drag: 0.6, intensity: 0.75 });
        if (i === 0 && Math.random() < 0.5) sc.vfx.smoke({ pos: p, count: 1, color: SPRAY, speed: [0.5, 1.5], dir: out, spread: 0.5, life: [0.5, 0.9], size: [0.3, 0.55], sizeEnd: 1.8, gravity: -0.5, drag: 1.2 });
      }
    }
    if (t > 1.5) {
      sea.surge.amp = 0;
      surgeL.kill();
    }
  });
  m.layers.push(surgeL);

  // Camera: pushes in slightly on the crash; the wave hits the camera and submerges it for 0.3 s; surfaces, retreats back and up, droplets hanging on the lens
  const look0 = sc.rig.look.clone();
  const back = cam0.clone().sub(at).setY(0).normalize();
  const high = cam0.clone().addScaledVector(back, camD * 0.35).addScaledVector(UP, L * 0.5 + 1.4);
  const lookHigh = at.clone().lerp(g.rest, 0.4).setY(g.sea + 0.4);
  const cam = { push: 0, up: 0 };
  ride(c, (pos, look) => {
    pos.copy(cam0).lerp(look0, 0.07 * cam.push).lerp(high, ease.inOutQuad(cam.up));
    look.copy(look0).lerp(lookHigh, ease.inOutQuad(cam.up));
  });
  tl.to(cam, { push: 1, duration: 0.24, ease: 'power2.out' }, 0);
  const floodTo = Math.max(0.6, cam0.y - g.sea + 0.7);
  tl.to(lens, { flood: floodTo, duration: 0.1, ease: 'power2.in' }, 0.18);
  tl.call(() => {
    playOr(surgeUrl, () => synth.noise({ type: 'lowpass', f0: 900, f1: 200, dur: 0.8, gain: 0.3 }), { gain: 0.5, rate: 0.8 });
    synth.noise({ type: 'lowpass', f0: 500, f1: 180, dur: 0.6, gain: 0.25 });
    sc.rig.addTrauma(0.35);
  }, [], 0.26);
  tl.to(lens, { bubbles: 1, duration: 0.08 }, 0.26);
  tl.to(lens, { bubbles: 0, duration: 0.25 }, 0.5);
  tl.to(cam, { up: 1, duration: 1.1, ease: 'none' }, 0.56);
  // The full moon sinks back into the sea with the ebb
  if (m.moon) tl.to(m.moon, { rise: 0, duration: 0.9, ease: 'power1.in' }, 0.7);
  tl.to(lens, { flood: 0, duration: 0.3, ease: 'power1.in' }, 0.56);
  tl.set(lens, { drops: 1 }, 0.72);
  tl.to(lens, { drops: 0, duration: 1.4, ease: 'power1.in' }, 0.8);

  // Two tide rings: as the high wave pushes outward, a ring of white wave closes in on where the whale stood
  tl.call(() => {
    sea.ebb.c.set(g.rest.x, g.rest.z);
    sea.ebb.w = 0.6;
    const D = Math.hypot(g.rest.x - at.x, g.rest.z - at.z) + 1.5;
    sea.ebb.r = D;
    sea.ebb.amp = 0.32;
    sc.gs.timeline('world').to(sea.ebb, { r: L * 0.35, duration: 0.9, ease: 'power1.in' }).to(sea.ebb, { amp: 0, duration: 0.35 }, 0.7);
  }, [], 0.5);
  swimHome(c, 0.62);
  tl.call(() => settle(c, 0.45, 0.4), [], 0.95);
}

/** Blocked: the whale crashes onto the barrier and is bounced off, falling slantwise back into the sea, the water crown only half rising; then the shared barrier holds, and it floats up from its place */
async function guarded(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  const g = m.g;
  if (g && m.sea && !m.homeBound) {
    m.homeBound = true;
    const A = act(c);
    const L = g.len;
    const to = g.foe.clone().addScaledVector(g.f, -(g.hf * 0.5 + L * 0.75)).addScaledVector(g.a, L * 0.2).setY(g.sea - L * 0.75);
    sinkAt(c, to, 0.62, L * 0.45);
    playOr(slamUrl, () => synth.noise({ type: 'lowpass', f0: 1400, f1: 120, dur: 0.7, gain: 0.4 }), { gain: 0.7 });
    const tl = sc.gs.timeline('world');
    tl.to(A, { roll: g.rollSign * 1.6, breach: 0.5, dive: 0, duration: 0.62, ease: 'power1.out' }, 0);
    const cr = m.crowns!.F;
    tl.to(cr, { rise: 0.55, duration: 0.22, ease: 'power2.out' }, 0);
    tl.to(cr, { fall: 1, duration: 0.5, ease: 'power1.in' }, 0.3);
    tl.call(() => cr.kill(), [], 0.9);
    tl.call(() => splash(c, to.clone().setY(g.sea), 1.3, 1.2), [], 0.48);
    swimHome(c, 0.7);
  }
  await ultGuarded(c);
}

/** After a miss or a block: on a miss it crashes into an empty sea; in both cases it floats up from its place, and then the cinematic is wrapped up */
function settleThs(c: UltCtx): void {
  const m = mem(c);
  const g = m.g;
  if (g && m.sea && !m.homeBound) {
    m.homeBound = true;
    const L = g.len;
    const A = act(c);
    const to = g.land.clone().addScaledVector(g.f, L * 0.3).setY(g.sea - L * 0.75);
    sinkAt(c, to, 0.36);
    c.sc.gs.timeline('world').to(A, { roll: g.rollSign * 1.3, dive: 0.8, breach: 0, duration: 0.36, ease: 'power1.in' });
    playOr(slamUrl, () => synth.noise({ type: 'lowpass', f0: 1400, f1: 120, dur: 0.7, gain: 0.4 }), { gain: 0.85 });
    const cr = m.crowns!.F;
    const tl = c.sc.gs.timeline('world');
    tl.to(cr, { rise: 0.8, duration: 0.25, ease: 'power2.out' }, 0.12);
    tl.to(cr, { fall: 1, duration: 0.6, ease: 'power1.in' }, 0.5);
    tl.call(() => splash(c, g.land.clone().setY(g.sea), 1.8, 1.4), [], 0.14);
    swimHome(c, 0.5);
  }
  settle(c, 0.6, 0.35);
}

// ───────────────────────── Afterglow ─────────────────────────

/** Weights, swimming, sea, moonlit night and materials are all restored; also called when leaving the battle midway, and calling it repeatedly is harmless */
function restoreWorld(c: UltCtx): void {
  const m = mem(c);
  const cr = creature(c);
  for (const l of m.layers) l.kill();
  m.layers = [];
  m.swim.on = false;
  if (cr && m.g) {
    cr.hover = m.g.hover0;
    cr.root.position.copy(c.sc.slots[c.side].home);
  }
  const A = act(c);
  for (const k of Object.keys(A)) A[k] = 0;
  m.night?.restore();
  m.night = undefined;
  if (m.mats.length) {
    const mats = m.mats;
    m.mats = [];
    // Wait for vfx to remove the meshes on the next frame before disposing the shared materials
    if (c.sc.disposed) for (const x of mats) x.dispose();
    else void c.sc.tw.wait(0.1, 'real').then(() => mats.forEach((x) => x.dispose()));
  }
  m.unreg?.();
  m.unreg = undefined;
}

/** The sea drains back underground, the full moon sinks into the horizon, and the sky returns to daytime; the whale rises from the sea surface back to its original height, and the weights go to zero */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  const g = m.g;
  c.cine.track(null);
  const A = act(c);
  const tl = sc.gs.timeline('world');
  if (g && m.sea) {
    const sea = m.sea;
    const sw = m.swim;
    const from = sw.p.clone();
    sw.path = lineTo(from, g.rest, (x) => x, ease.inOutQuad);
    sw.u = 0;
    tl.to(sw, { u: 1, duration: 0.9, ease: 'none' }, 0);
    tl.to(sea, { level: -0.5, moonAmt: 0, duration: 0.9, ease: 'power1.in' }, 0);
    playOr(surgeUrl, () => synth.noise({ type: 'lowpass', f0: 900, f1: 200, dur: 1, gain: 0.2 }), { gain: 0.4, rate: 0.7 });
  }
  if (m.moon) tl.to(m.moon, { rise: 0, duration: 0.8, ease: 'power1.in' }, 0);
  if (m.night) tl.to(m.night, { k: 0, duration: 0.9, ease: 'power1.inOut' }, 0.05);
  tl.to(A, { roll: 0, dive: 0, fluke: 0, breach: 0, swim: 0, sing: 0, duration: 0.4, ease: 'power2.inOut' }, 0);
  tl.to(A, { glow: 0, duration: 0.7, ease: 'power1.inOut' }, 0.1);
  tl.to(A, { focus: 0, duration: 0.5, ease: 'power1.inOut' }, 0.5);
  tl.set({}, {}, 1.0);
  await playTimeline(tl);
  restoreWorld(c);
}

export default defineSsr({
  windup,
  deliver,
  impact,
  guarded,
  settle: settleThs,
  after,
  // The sea at night: the generic impact light orb and white flash would wash the night out to grey-white, so the impact visuals are made entirely by impact
  quietHit: true,
});
