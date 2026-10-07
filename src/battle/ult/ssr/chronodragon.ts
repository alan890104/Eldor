// Chronos, the Hourglass Nautilus: "End of Time"
//
// What this cinematic is about: the old nautilus turns tight, with its own hand, the mainspring on its back that no one has wound since the Night of the Shattered Heart, and the clock that stood still for a thousand years runs for the first time; it tosses up and flips the hourglass it was born with,
// and the world stops at the moment the hourglass turns upside down. In the stopped time only it is still moving: behind the opponent it raises a giant clock identical to its own bezel, sets the time marks carved into the opponent onto the dial
// and fast-forwards them until they come due; then it releases the mainspring, and a thousand years of time sand spirals out of the inverted hourglass toward the opponent, stopping an inch in front of it.
// At the moment time flows back, everything happens at once: the sand stream floods into the opponent, the giant clock runs backward and shatters, and the fulfilled time marks burst one after another.
//
// Model: the hourglass nautilus (src/render/lab/chronodragonModel.ts), no longer a dragon. The old ultimate's hourglass on the back, upright sand-spitting and forehead clock no longer exist, and the whole sequence was rewritten.
// Action weights used: focus, peer, bezel, glow, wind, jolt, hands, dial, lift, toss, flip, retract.
// Positions come only from anchors: head, eyes, bezel0 to bezel11, crest, key, keyBase, hourglass, clockL/clockR, spiral;
// the legacy model (&port=off) has none of these anchors, so it falls back to estimates from sc.head and sc.center, and the VFX for the bezel and mainspring are skipped.
// The giant clock's bezel, gears, index studs, crown ornament, hands and sand chunks are solid scene objects (sceneMaterial + heavy-line outline); the clock face's Roman numerals, time marks, glow and sand grains go through VFX.
//
// Time: windup runs on the world clock (GSAP). deliver freezes the whole world right from the start (stage.timeScale = 0): the arena, weather, particles and the opponent are all frozen,
// and the cinematic switches to a GSAP timeline on the real clock (multiplied by battle speed); Chronos's idle animation keeps running in the time stop (only it is still moving).
// During the time stop, vfx particles and spawn effects do not move (newly sprayed particles are not even uploaded), so the light specks, sand grains and flashes in the time stop are all this script's own objects,
// reading the real clock; particles sprayed before the stop just hang in midair. Time flows back when deliver ends.
//
// Shot list (seconds)
//   windup (world clock)
//     0.00  Announcement: letterbox, the music is pulled out, warm gold tint; the camera at audience side 36°, shooting up from below the face at the face framed by the bezel, pushing in and turning to 22° within 0.66 s.
//           It stops to look around (focus) and peeks out of the shell opening (peer). The index studs of the bezel light up clockwise one by one from one o'clock (bezel), one tick of the second hand for each.
//     0.50  The crown ornament at twelve o'clock lights up last, the dawn stone flashes; at 0.52 golden eye glints (glow). Sound: one clear "ching".
//     0.66  Winding the spring (cut): the camera behind and above the shell, the key shaft in the foreground and the opponent in the distance; within 0.70 s it orbits around the spiral's core to the side (150° → 100°),
//           bringing the clock face on the audience side into the frame. At 0.80 / 1.00 / 1.20 the key turns half a turn each time (wind), the ratchet catches a notch and the shell jolts (jolt),
//           the keyhole sprays brass sparks and sand dust, and the ring of golden mainspring spiral on the clock faces at the two sides tightens a little more each time; the hands jump a notch along. Sound: three heavy ratchet clicks.
//     1.26  The clock wakes: the hands that stood still for a thousand years move for the first time, faster and faster (hands), and the clock face gives off a warm glow (dial). Sound: the ticking gets denser and denser.
//     1.36  Tossing the hourglass (cut): a low angle from the front toward the audience side, with the face and the space above its head; a tentacle raises the hourglass (lift), at 1.44 it is tossed up (toss),
//           the hourglass rights itself as it flies beside the crown ornament, at 1.52 it spins a turn and a half in midair and turns upside down (flip 0 → 3), and the sand lights up inside the glass (glow).
//           The look-at point follows the hourglass upward. Sand grains and light specks thrown up before the time stop. Sound: a light chime of glass, a gust of wind.
//     1.90  End: the hourglass has just turned upside down.
//   deliver (time stops at the start; afterwards it runs on the real clock)
//     0.00  Time stop: "thud". An inverted-color flash, the frame fades to cold grey (leaving color only at the center of the frame, with outlines still clear), a ring of time wave sweeps out over the whole arena from the hourglass;
//           the sand grains thrown up, the rain, the arena's motion and the opponent all stop. Sound: one stroke of the great bell, ear ringing and an extremely low hum.
//           The camera orbits 85° around Chronos from the hourglass shot's position (audience side 12° → 97°), the sand grains suspended in midair sliding past in front of the lens; only it is still moving, the clocks on both sides racing (hands).
//     0.62  Heaven's Clock (cut to the target's view): behind the opponent a giant clock rises from underground: brass bezel, a ring of bronze gears behind it, eleven index studs, and a sunrise crown ornament at twelve,
//           identical to its own bezel; the Roman numerals of the clock face are drawn in along with a sweep of light. From 0.72 the time marks on the opponent fly up one by one
//           and set into the index positions starting from one o'clock (count = stacks). The camera slowly pushes in. Sound: the huge pendulum mechanism turning and locking into place.
//     1.00  Fast-forward: the giant clock's hands spin wildly, the remaining countdown turns run through lap after lap, and the time marks the minute hand sweeps past light up in order as "fulfilled". Sound: the second-hand ticks merge into one mass, a bell stroke for each mark, each higher than the last.
//     1.62  Twelve o'clock: the two hands stop at twelve, the crown ornament flashes. Sound: a low bell stroke.
//     1.72  Releasing the spring (cut): from behind and above on the audience side over the shell's back, the key in the foreground, the opponent and giant clock in the distance; the key turns back to release (wind back to 0),
//           the hands on both sides run backward to their original place (hands back to 0), and the shell jolts. The color at the center of the frame (following the sand stream) returns, while the surroundings are still stopped grey.
//           Sound: the ratchet sound of the mainspring letting go all at once, a rewind sound starts to build.
//     1.90  From the inverted hourglass, a thousand years of time sand spirals out: three streams of sand twisted into one, flying along an arc toward the opponent, with sand chunks and golden sand grains swirling along.
//           The camera slides forward from behind the shell alongside the sand stream while pulling back, finally framing Chronos, the sand stream, the opponent and the giant clock in one picture.
//           Sound: the howl of the sand stream; the end of the rewind sound lands at 2.46.
//     2.46  The leading edge of the sand stream stops an inch in front of the opponent (time is still stopped); at 2.50 it ends and time flows back.
//   impact (quietHit: the impact visuals are made by itself)
//     0.00  Time flows back: color returns all at once, a flash of warm color; the sand stream floods into the opponent, and the suspended sand grains and chunks rush in together; the giant clock's hands run backward, and the bezel, gears and index studs
//           shatter into chunks of brass flying outward, the clock face breaking into shards of glass; the mark of a clock face is burned into the ground. The arena, rain and particles start moving again. Sound: all the clocks tick one notch together, sand and brass shattering.
//     0.05  The camera pushes in a little toward the opponent (target's view), and at 0.35 retreats back 1.2x and rises.
//     0.30  The hourglass turns another half turn back to upright and drops back into the tentacle, and the tentacle lowers.
//     0.40  Fulfilled: the time marks set on the dial rush one by one at the opponent and burst (followed by the engine's "Prophecy Fulfilled" damage). Sound: bell strokes, each higher than the last.
//     1.00  Post-processing eases back, and after 0.45 s it pulls back to the wide shot.
//   guarded: the sand stream hits the barrier and scatters into a sand mist; the giant clock's hands run backward and the whole clock sinks back underground; the time marks crack and fall (the engine: guard blocked the fulfillment, and the time marks shattered);
//           then the shared "barrier almost shattered, finally holds".
//   after: weights go to zero (the hourglass is already back in the tentacle; if interrupted midway it is first turned to upright and then lowered); all VFX are removed, and the time scale, post-processing and camera are restored by the safety net.

import { gsap } from 'gsap';
import * as THREE from 'three';
import { playOr, preloadSamples } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import breathUrl from '../../../audio/sfx/chronodragon-breath.mp3';
import chimeUrl from '../../../audio/sfx/chronodragon-chime.mp3';
import clockUrl from '../../../audio/sfx/chronodragon-clock.mp3';
import ffUrl from '../../../audio/sfx/chronodragon-ff.mp3';
import flipUrl from '../../../audio/sfx/chronodragon-flip.mp3';
import rewindUrl from '../../../audio/sfx/chronodragon-rewind.mp3';
import sandUrl from '../../../audio/sfx/chronodragon-sand.mp3';
import shatterUrl from '../../../audio/sfx/chronodragon-shatter.mp3';
import tickUrl from '../../../audio/sfx/chronodragon-tick.mp3';
import tollUrl from '../../../audio/sfx/chronodragon-toll.mp3';
import unwindUrl from '../../../audio/sfx/chronodragon-unwind.mp3';
import windUrl from '../../../audio/sfx/chronodragon-wind.mp3';
import { starTex } from '../../../render/fxtex.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { outline, rbox, slab, wedge } from '../../../render/lab/shapes.ts';
import { sceneMaterial, type SpiritMaterial } from '../../../render/spiritToon.ts';
import { glowTex } from '../../../render/textures.ts';
import { ease } from '../../../render/tween.ts';
import type { FxLayer } from '../../../render/vfx.ts';
import { ultSfx, type Look } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, eyeGlint, settle } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [tickUrl, tollUrl, chimeUrl, breathUrl, shatterUrl, sandUrl, windUrl, unwindUrl, clockUrl, ffUrl, flipUrl, rewindUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const GOLD = 0xf2c66a;
const GOLD_HI = 0xfff0c8;
const SAND = 0xd8b070;
const SAND_LT = 0xf4dca8;
const SAND_DK = 0xb88a4a;
const BRASS = 0xe2b24e;
const BRASS_DK = 0xc89438;
const BRONZE = 0x9c6a38;
const DAWN = 0xffb070;
/** Cold grey tint of the time stop (multiplied onto the frame; do not go darker than this, or outlines and dark areas can no longer be told apart) */
const COLD = 0xc4cede;
/** Warm gold tint of the announcement */
const WARM = 0xffecd0;
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = THREE.MathUtils.smoothstep;
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};

// Timetable (seconds): each beat of the shot list; the seconds in the file header match these
const W = {
  stud0: 0.06,
  studGap: 0.04,
  crest: 0.5,
  glint: 0.52,
  key: 0.66,
  clicks: [0.8, 1.0, 1.2],
  wake: 1.26,
  hg: 1.36,
  toss: 1.44,
  flip: 1.52,
  flipDur: 0.36,
  end: 1.9,
};
const D = {
  orbitDur: 0.62,
  clock: 0.62,
  rise: 0.36,
  seals: 0.72,
  ff: 1.0,
  ffDur: 0.62,
  twelve: 1.62,
  release: 1.72,
  launch: 1.9,
  arrive: 2.46,
  end: 2.5,
};

// ───────────────────────── State ─────────────────────────

/** The geometry of this cinematic: all computed from the positions, heights and anchors of the two sides */
interface Geo {
  h: number;
  hf: number;
  /** The horizontal direction from the caster toward the opponent, and the horizontal direction of the audience side */
  f: THREE.Vector3;
  a: THREE.Vector3;
  home: THREE.Vector3;
  foe: THREE.Vector3;
  dist: number;
  /** The giant clock: radius, center, and facing direction of its front (horizontal) */
  R: number;
  clockC: THREE.Vector3;
  clockN: THREE.Vector3;
  /** Anchors of the clock face on the side the audience can see */
  side: 'clockL' | 'clockR';
}

interface Kit {
  brass: SpiritMaterial;
  brassDk: SpiritMaterial;
  bronze: SpiritMaterial;
  sand: SpiritMaterial;
  mats: THREE.Material[];
}

interface Mem {
  g?: Geo;
  n: number;
  turns: number;
  layers: FxLayer[];
  offs: (() => void)[];
  /** Real clock (multiplied by battle speed); the VFX read this during the time stop */
  rt: number;
  frozen: boolean;
  kit?: Kit;
  studs?: Studs;
  springs?: Springs;
  clock?: BigClock;
  seals?: Seals;
  torrent?: Torrent;
  flares?: Flares;
  cleanup?: () => void;
  /** Things already removed at impact (on a guard, the impact scenes are no longer played) */
  hit?: boolean;
}
const mem = (c: UltCtx): Mem => (c.mem.chrono ??= { n: 0, turns: 1, layers: [], offs: [], rt: 0, frozen: false }) as Mem;
const creature = (c: UltCtx) => c.sc.slots[c.side].creature;
/** The nautilus's action weights (only effective on the experimental model) */
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

const has = (c: UltCtx, name: string): boolean => !!creature(c)?.anchor(name);

function geometry(c: UltCtx): Geo {
  const { sc, side, foe, cine } = c;
  const cr = creature(c);
  const fc = sc.slots[foe].creature;
  const h = cr?.worldHeight ?? 2.4;
  const hf = fc?.worldHeight ?? 1.5;
  const home = sc.slots[side].home.clone().setY(0);
  const foeHome = sc.slots[foe].home.clone().setY(0);
  const f = cine.forward(side);
  const a = cine.orbitPos(side, new THREE.Vector3(), 90, 1, 0).setY(0).normalize();
  const R = hf * 0.8 + 1.3;
  const clockN = f.clone().multiplyScalar(-Math.cos(0.66)).addScaledVector(a, Math.sin(0.66)).normalize();
  const clockC = foeHome.clone().addScaledVector(f, (fc?.width ?? hf) * 0.4 + 1.0).setY(R * 0.93);
  const sp = anchorPos(c, 'spiral', () => sc.center(side));
  const cl = anchorPos(c, 'clockL', () => sp);
  const clockSide = cl.sub(sp).dot(a) >= 0 ? 'clockL' : 'clockR';
  return { h, hf, f, a, home, foe: foeHome, dist: home.distanceTo(foeHome), R, clockC, clockN, side: clockSide };
}

/** How far away to frame a region of height hgt and width wid completely (by the current field-of-view multiplier and aspect ratio) */
function fitDist(c: UltCtx, hgt: number, wid: number, fovScale: number): number {
  const { sc } = c;
  const cam = sc.stage.camera;
  const halfTan = Math.tan(THREE.MathUtils.degToRad((cam.fov / sc.stage.fovScale) * fovScale * 0.5));
  return Math.max((hgt * 0.5) / halfTan, (wid * 0.5) / (halfTan * cam.aspect));
}

/** The program sets the camera position every frame (it also runs during the time stop); automatically void when another camera move takes over */
function ride(c: UltCtx, fn: (pos: THREE.Vector3, look: THREE.Vector3) => void): void {
  const rig = c.sc.rig;
  const tok = rig.claim();
  const layer = c.sc.vfx.layer(new THREE.Object3D(), () => {
    if (!rig.owns(tok)) {
      layer.kill();
      return;
    }
    fn(rig.pos, rig.look);
  });
  mem(c).layers.push(layer);
}

// ───────────────────────── Time ─────────────────────────

/** Real clock: during the time stop world/fx do not run while this one does (multiplied by battle speed); Chronos's idle animation also advances with it during the time stop */
function startClock(c: UltCtx): void {
  const m = mem(c);
  const sc = c.sc;
  const off = sc.stage.add((_dt, _fx, real) => {
    const d = real * sc.tw.speed;
    m.rt += d;
    if (m.frozen) {
      const cr = creature(c);
      if (cr) cr.time += d;
    }
  });
  const unreg = sc.addCleanup(off);
  m.offs.push(() => {
    off();
    unreg();
  });
}

/** A GSAP timeline on the real clock (it runs during the time stop, is multiplied by battle speed, and does not take hit-stop); it tears itself down when it finishes or is interrupted */
function realTimeline(c: UltCtx): gsap.core.Timeline {
  const sc = c.sc;
  const tl = gsap.timeline({ paused: true });
  const off = sc.stage.add((_dt, _fx, real) => {
    if (real > 0) tl.totalTime(tl.totalTime() + real * sc.tw.speed);
  });
  const unreg = sc.addCleanup(() => {
    off();
    tl.kill();
  });
  const stop = () => {
    off();
    unreg();
  };
  mem(c).offs.push(stop);
  tl.eventCallback('onComplete', stop);
  tl.eventCallback('onInterrupt', stop);
  return tl;
}

function freeze(c: UltCtx): void {
  mem(c).frozen = true;
  c.sc.stage.timeScale = 0;
}

function thaw(c: UltCtx): void {
  mem(c).frozen = false;
  c.sc.stage.timeScale = 1;
}

const LOOK_NUM = ['letterbox', 'desat', 'vignette', 'isolate', 'radial', 'lines', 'haze', 'hazeRadius', 'grain', 'bloom', 'fov', 'roll'] as const;
const LOOK_COL = ['tint', 'lift'] as const;

/** Post-processing tweens are put on the real clock's timeline (cine.look uses the fx clock, which would stop during the time stop) */
function rlook(c: UltCtx, tl: gsap.core.Timeline, from: Look, to: Look, dur: number, at: number, e = 'power1.inOut'): void {
  const k = { v: 0 };
  const tmp = new THREE.Color();
  const cols = LOOK_COL.filter((x) => to[x] !== undefined).map((x) => ({ x, a: new THREE.Color(from[x] ?? (x === 'lift' ? 0x000000 : 0xffffff)), b: new THREE.Color(to[x]!) }));
  const apply = () => {
    const l: Look = {};
    for (const key of LOOK_NUM) {
      const b = to[key];
      if (b === undefined) continue;
      const a = from[key] ?? b;
      l[key] = a + (b - a) * k.v;
    }
    for (const x of cols) l[x.x] = tmp.lerpColors(x.a, x.b, k.v).getHex();
    void c.cine.look(l, 0);
  };
  tl.to(k, { v: 1, duration: dur, ease: e, onUpdate: apply, onStart: apply }, at);
}

// ───────────────────────── Textures and materials ─────────────────────────

const texCache = new Map<string, THREE.Texture>();
function makeTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** The giant clock's face: sixty minute marks, Roman numerals, and twelve small diamonds on the inner ring (the bezel and index studs are solid and not drawn here) */
function dialTex(): THREE.Texture {
  return makeTex('chrono-dial2', 1024, (g, s) => {
    const c = s / 2;
    g.strokeStyle = g.fillStyle = 'white';
    g.lineCap = 'round';
    const circle = (r: number, w: number) => {
      g.lineWidth = w;
      g.beginPath();
      g.arc(c, c, r, 0, TAU);
      g.stroke();
    };
    circle(s * 0.462, 5);
    circle(s * 0.26, 3);
    circle(s * 0.05, 5);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU;
      const hour = i % 5 === 0;
      const r0 = s * (hour ? 0.405 : 0.43);
      const r1 = s * 0.458;
      g.lineWidth = hour ? 12 : 4;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      g.stroke();
    }
    g.font = `bold ${Math.floor(s * 0.085)}px "Times New Roman", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const roman = ['Ⅻ', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ'];
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * TAU;
      g.save();
      g.translate(c + Math.cos(a) * s * 0.34, c + Math.sin(a) * s * 0.34);
      g.rotate(a + Math.PI / 2);
      g.fillText(roman[i], 0, 0);
      g.restore();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.save();
      g.translate(c + Math.cos(a) * s * 0.215, c + Math.sin(a) * s * 0.215);
      g.rotate(a);
      g.beginPath();
      g.moveTo(-s * 0.014, 0);
      g.lineTo(0, -s * 0.007);
      g.lineTo(s * 0.014, 0);
      g.lineTo(0, s * 0.007);
      g.closePath();
      g.fill();
      g.restore();
    }
  });
}

/** Time mark: an hourglass inside a circular frame, with an arc above and below */
function sealTex(): THREE.Texture {
  return makeTex('chrono-seal', 256, (g, s) => {
    const c = s / 2;
    g.strokeStyle = g.fillStyle = 'white';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 9;
    g.beginPath();
    g.arc(c, c, s * 0.4, 0, TAU);
    g.stroke();
    g.lineWidth = 4;
    g.beginPath();
    g.arc(c, c, s * 0.32, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    g.beginPath();
    g.arc(c, c, s * 0.32, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
    g.lineWidth = 7;
    const w = s * 0.13;
    const hh = s * 0.19;
    g.beginPath();
    g.moveTo(c - w, c - hh);
    g.lineTo(c + w, c - hh);
    g.lineTo(c - w, c + hh);
    g.lineTo(c + w, c + hh);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(c - w * 0.6, c + hh * 0.88);
    g.lineTo(c + w * 0.6, c + hh * 0.88);
    g.lineTo(c, c + hh * 0.25);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(c - w * 0.35, c - hh * 0.6);
    g.lineTo(c + w * 0.35, c - hh * 0.6);
    g.lineTo(c, c - hh * 0.1);
    g.closePath();
    g.fill();
  });
}

/** A glowing sprite plane (additive, no depth write) */
function glowSprite(map: THREE.Texture, color: THREE.ColorRepresentation, inten: number, depthTest = true): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: new THREE.Color(color).multiplyScalar(inten), transparent: true, opacity: 0, depthWrite: false, depthTest, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.renderOrder = 8;
  return s;
}

/** This move's scene materials (the same cartoon shading as the arena, going through heavy-line outlines); released together when the cinematic ends */
function makeKit(c: UltCtx): Kit {
  const kit: Kit = {
    brass: sceneMaterial(BRASS, { surface: 'metal', rim: 0.5 }),
    brassDk: sceneMaterial(BRASS_DK, { surface: 'metal', rim: 0.45 }),
    bronze: sceneMaterial(BRONZE, { surface: 'metal', rim: 0.4 }),
    sand: sceneMaterial(SAND, { rim: 0.35, emissive: 0xffc070, emissiveAmt: 0.06 }),
    mats: [],
  };
  kit.mats.push(kit.brass, kit.brassDk, kit.bronze, kit.sand);
  // Must also be released when leaving the battle midway
  mem(c).cleanup = c.sc.addCleanup(() => {
    for (const x of kit.mats) x.dispose();
  });
  return kit;
}

/** When removing the VFX only their own geometry and materials are released; the shared scene materials stay until the cinematic ends (releasing them first would make the next object that uses them recompile its shaders) */
function disposeOwn(root: THREE.Object3D, kit: Kit): () => void {
  return () =>
    root.traverse((x) => {
      const o = x as THREE.Mesh;
      if (!(x as THREE.Sprite).isSprite) o.geometry?.dispose();
      const mat = o.material as THREE.Material | undefined;
      if (mat && !kit.mats.includes(mat)) mat.dispose();
    });
}

/** Solid scene object: outline layer on, marked as the scene's heavy line */
function solid(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.layers.enable(INK_LAYER);
  m.userData.inkScene = true;
  m.userData.inkHeavy = true;
  return m;
}

// ───────────────────────── Flashes on the real clock ─────────────────────────

/** A flash that also moves during the time stop (four-pointed star + core); vfx.glint uses the fx clock, which would stick on the first frame during the time stop */
interface Flares {
  at(pos: THREE.Vector3 | (() => THREE.Vector3), color: THREE.ColorRepresentation, size: number, dur: number): void;
  kill(): void;
}
function makeFlares(c: UltCtx): Flares {
  const m = mem(c);
  const root = new THREE.Group();
  const pool: { star: THREE.Sprite; core: THREE.Sprite; t0: number; dur: number; size: number; pos: THREE.Vector3 | (() => THREE.Vector3) | null; spin: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const star = glowSprite(starTex(), 0xffffff, 2.4, false);
    const core = glowSprite(glowTex(), 0xffffff, 2, false);
    star.renderOrder = core.renderOrder = 20;
    star.visible = core.visible = false;
    root.add(star, core);
    pool.push({ star, core, t0: 0, dur: 1, size: 1, pos: null, spin: hash(i) * TAU });
  }
  let next = 0;
  const layer = c.sc.vfx.layer(root, () => {
    for (const p of pool) {
      if (!p.pos) continue;
      const k = (m.rt - p.t0) / p.dur;
      if (k >= 1) {
        p.pos = null;
        p.star.visible = p.core.visible = false;
        continue;
      }
      const at = typeof p.pos === 'function' ? p.pos() : p.pos;
      const o = k < 0.15 ? k / 0.15 : Math.pow(Math.max(0, 1 - (k - 0.15) / 0.85), 1.6);
      const s = p.size * (0.6 + 0.6 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5));
      p.star.position.copy(at);
      p.core.position.copy(at);
      p.star.scale.setScalar(s);
      p.core.scale.setScalar(s * 0.45);
      (p.star.material as THREE.SpriteMaterial).rotation = p.spin + k * 0.6;
      (p.star.material as THREE.SpriteMaterial).opacity = o;
      (p.core.material as THREE.SpriteMaterial).opacity = o;
    }
  });
  m.layers.push(layer);
  return {
    at(pos, color, size, dur) {
      const p = pool[next];
      next = (next + 1) % pool.length;
      p.pos = typeof pos === 'function' ? pos : pos.clone();
      p.t0 = m.rt;
      p.dur = dur;
      p.size = size;
      (p.star.material as THREE.SpriteMaterial).color.set(color).multiplyScalar(2.4);
      (p.core.material as THREE.SpriteMaterial).color.set(color).lerp(new THREE.Color(0xffffff), 0.6).multiplyScalar(2);
      p.star.visible = p.core.visible = true;
    },
    kill: () => layer.kill(),
  };
}

// ───────────────────────── Index studs on the bezel ─────────────────────────

/** One light speck for each of the twelve index studs on the bezel (lit: always on, pop: the flash as it lights up); skipped when the legacy model has no bezel */
interface Studs {
  lit: number[];
  pop: number[];
  kill(): void;
}
function makeStuds(c: UltCtx, h: number): Studs {
  const m = mem(c);
  const st: Studs = { lit: new Array(12).fill(0), pop: new Array(12).fill(0), kill: () => {} };
  if (!has(c, 'bezel0')) return st;
  const root = new THREE.Group();
  const dots = Array.from({ length: 12 }, (_, i) => {
    const s = glowSprite(glowTex(), i === 0 ? DAWN : GOLD, 1.6);
    root.add(s);
    return s;
  });
  const cam = c.sc.stage.camera;
  const tmp = new THREE.Vector3();
  const layer = c.sc.vfx.layer(root, () => {
    for (let i = 0; i < 12; i++) {
      const s = dots[i];
      const k = st.lit[i];
      const p = st.pop[i];
      s.visible = k > 0.001 || p > 0.001;
      if (!s.visible) continue;
      // Nudged toward the camera, so it is not cut in half by the bezel's surface
      const at = anchorPos(c, `bezel${i}`, () => c.sc.head(c.side));
      at.addScaledVector(tmp.copy(cam.position).sub(at).normalize(), h * 0.04);
      s.position.copy(at);
      const big = i === 0 ? 1.8 : i % 3 === 0 ? 1.25 : 1;
      s.scale.setScalar(h * 0.055 * big * (0.8 + 0.25 * k + 1.4 * p));
      (s.material as THREE.SpriteMaterial).opacity = Math.min(1, k * (0.62 + 0.18 * Math.sin(m.rt * 7 + i * 1.7)) + p);
    }
  });
  m.layers.push(layer);
  st.kill = () => layer.kill();
  return st;
}

// ───────────────────────── Mainspring spirals on the clock faces at the two sides ─────────────────────────

const springFrag = /* glsl */ `
  uniform vec3 uCol; uniform float uA; uniform float uK; uniform float uT; uniform float uIn;
  varying vec2 vUv;
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float ang = atan(p.y, p.x) / 6.2831853;
    // Archimedean spiral: the turns tighten and multiply, the whole spiral curls inward; the inner edge hugs the bezel of the clock face
    float N = mix(2.0, 3.6, uK);
    float s = fract(r * N - ang + uT);
    float band = smoothstep(0.0, 0.1, s) * smoothstep(0.5, 0.22, s);
    float fade = smoothstep(1.0, 0.82, r) * smoothstep(uIn - 0.02, uIn + 0.08, r);
    float a = band * fade * uA;
    gl_FragColor = vec4(uCol * a, a);
  }`;
const flatVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** A ring of mainspring spiral in front of the clock faces on both sides: the larger k is, the tighter and smaller it is; a is brightness */
interface Springs {
  k: number;
  a: number;
  kill(): void;
}
function makeSprings(c: UltCtx, h: number): Springs {
  const m = mem(c);
  const sp: Springs = { k: 0, a: 0, kill: () => {} };
  const names = ['clockL', 'clockR'].filter((n) => has(c, n));
  if (!names.length) return sp;
  const root = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(GOLD).multiplyScalar(2.2) }, uA: { value: 0 }, uK: { value: 0 }, uT: { value: 0 }, uIn: { value: 0.5 } },
    vertexShader: flatVert,
    fragmentShader: springFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const planes = names.map(() => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    p.renderOrder = 6;
    root.add(p);
    return p;
  });
  const q = new THREE.Quaternion();
  const n = new THREE.Vector3();
  const ws = new THREE.Vector3();
  const layer = c.sc.vfx.layer(root, () => {
    // The spiral's outer edge tightens from 2.2 times the bezel to 1.35 times (the clock face radius is 0.185 in the model)
    const out = 2.2 - 0.85 * sp.k;
    mat.uniforms.uIn.value = 1 / out;
    mat.uniforms.uA.value = sp.a;
    mat.uniforms.uK.value = sp.k;
    mat.uniforms.uT.value = m.rt * (0.4 + sp.k * 1.6);
    root.visible = sp.a > 0.001;
    if (!root.visible) return;
    const cr = creature(c);
    names.forEach((name, i) => {
      const a = cr?.anchor(name);
      if (!a) return;
      a.getWorldQuaternion(q);
      n.set(0, 0, 1).applyQuaternion(q);
      planes[i].position.copy(anchorPos(c, name, () => c.sc.center(c.side))).addScaledVector(n, h * 0.012);
      planes[i].quaternion.copy(q);
      a.getWorldScale(ws);
      planes[i].scale.setScalar(0.185 * ws.x * out);
    });
  });
  m.layers.push(layer);
  sp.kill = () => layer.kill();
  return sp;
}

// ───────────────────────── Time wave ─────────────────────────

const waveFrag = /* glsl */ `
  uniform vec3 uA0; uniform vec3 uA1; uniform float uA; uniform float uMix;
  varying vec3 vN; varying vec3 vV;
  void main(){
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float a = pow(max(f, 0.0), 2.6) * uA;
    vec3 col = mix(uA0, uA1, uMix);
    gl_FragColor = vec4(col * a, a);
  }`;
const waveVert = /* glsl */ `varying vec3 vN; varying vec3 vV;
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

/** At the moment of the time stop, a spherical shell sweeping out over the whole arena from the hourglass (k 0 to 1) */
function makeWave(c: UltCtx, at: THREE.Vector3, h: number, lo: boolean): { k: number; kill(): void } {
  const w = { k: 0, kill: () => {} };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uA0: { value: new THREE.Color(GOLD_HI).multiplyScalar(1.2) }, uA1: { value: new THREE.Color(0xb8d0ff).multiplyScalar(0.9) }, uA: { value: 0 }, uMix: { value: 0 } },
    vertexShader: waveVert,
    fragmentShader: waveFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  s.renderOrder = 7;
  s.position.copy(at);
  const layer = c.sc.vfx.layer(s, () => {
    const k = w.k;
    s.visible = k > 0 && k < 1;
    s.scale.setScalar(h * 0.2 + ease.outCubic(k) * 30);
    mat.uniforms.uA.value = Math.pow(1 - k, 1.4) * (lo ? 0.4 : 0.7);
    mat.uniforms.uMix.value = k;
  });
  mem(c).layers.push(layer);
  w.kill = () => layer.kill();
  return w;
}

// ───────────────────────── Giant clock ─────────────────────────

const dialFrag = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uCol; uniform float uA; uniform float uReveal; uniform float uT;
  varying vec2 vUv;
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    // Clockwise angle measured from the top of the dial (0-1)
    float ang = fract(0.25 - atan(p.y, p.x) / 6.2831853);
    float rev = smoothstep(ang - 0.02, ang + 0.04, uReveal);
    float m = texture2D(uMap, vUv).a * rev;
    // The bright edge that sweeps past
    float edge = exp(-abs(ang - uReveal) * 40.0) * step(uReveal, 0.999) * smoothstep(0.05, 0.2, r) * smoothstep(1.0, 0.9, r);
    float sheen = pow(max(0.0, 1.0 - abs(p.x * 0.6 + p.y * 0.8 - sin(uT * 0.5) * 0.9) * 1.8), 3.0) * smoothstep(0.98, 0.9, r) * 0.12;
    float a = (m + edge * 1.4 + sheen * rev) * uA;
    gl_FragColor = vec4(uCol * a, a);
  }`;

/** Gear outline: a ring of trapezoidal teeth on the outer edge, hollowed out in the middle */
function gearShape(rRoot: number, rTip: number, teeth: number, rHole: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = i % 4;
    const r = k === 1 || k === 2 ? rTip : rRoot;
    const aa = a + (k === 1 ? 0.25 : k === 2 ? -0.25 : 0) * (TAU / n);
    if (i === 0) s.moveTo(Math.cos(aa) * r, Math.sin(aa) * r);
    else s.lineTo(Math.cos(aa) * r, Math.sin(aa) * r);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, rHole, 0, TAU, true);
  s.holes.push(hole);
  return s;
}

interface Piece {
  m: THREE.Object3D;
  /** Velocity and rotation of the pieces flying outward on shattering */
  v: THREE.Vector3;
  w: THREE.Vector3;
  home: THREE.Vector3;
}

/** The giant clock behind the opponent: the same language as the nautilus's own bezel (brass bezel, eleven index studs, a sunrise crown ornament at twelve), with a ring of bronze gears behind it */
interface BigClock {
  root: THREE.Group;
  st: { rise: number; reveal: number; face: number; glow: number; hour: number; min: number; crest: number; shatter: number; sink: number };
  pop: number[];
  /** World position of the i-th time mark (at (i + 1) o'clock) */
  hourPos(i: number): THREE.Vector3;
  kill(): void;
}
function makeClock(c: UltCtx, g: Geo, kit: Kit): BigClock {
  const m = mem(c);
  const { R } = g;
  const root = new THREE.Group();
  root.position.copy(g.clockC);
  root.lookAt(g.clockC.clone().add(g.clockN));
  const body = new THREE.Group();
  root.add(body);
  const st = { rise: 0, reveal: 0, face: 0, glow: 0, hour: 0, min: 0, crest: 0, shatter: 0, sink: 0 };
  const pieces: Piece[] = [];
  const piece = (o: THREE.Object3D, parent: THREE.Object3D = body) => {
    parent.add(o);
    const out = o.position.clone().setZ(0);
    const dir = out.lengthSq() > 1e-6 ? out.normalize() : new THREE.Vector3(hash(pieces.length) - 0.5, 1, 0).normalize();
    const i = pieces.length;
    pieces.push({
      m: o,
      home: o.position.clone(),
      v: dir.multiplyScalar(R * (1.2 + hash(i * 3.1) * 1.4)).add(new THREE.Vector3(0, R * (0.4 + hash(i * 7.7) * 0.8), R * (0.6 + hash(i * 5.3) * 1.2))),
      w: new THREE.Vector3(hash(i * 1.3) - 0.5, hash(i * 2.9) - 0.5, hash(i * 4.1) - 0.5).multiplyScalar(9),
    });
  };
  // The bronze gears behind
  const gear = solid(slab(gearShape(R * 1.06, R * 1.16, 40, R * 0.97), R * 0.05, R * 0.012, 3), kit.bronze);
  gear.position.z = -R * 0.07;
  const gearG = new THREE.Group();
  gearG.add(gear);
  piece(gearG);
  // Bezel: eight brass arc segments (each flying off on its own when shattered), with a thin ring on the inside
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * TAU + 0.004;
    const a1 = ((i + 1) / 8) * TAU - 0.004;
    const seg = new THREE.Group();
    const mid = (a0 + a1) / 2;
    seg.position.set(Math.cos(mid) * R * 0.95, Math.sin(mid) * R * 0.95, 0);
    const outer = solid(slab(wedge(R * 0.9, R * 1.0, a0, a1), R * 0.09, R * 0.014, 8), kit.brass);
    outer.position.set(-seg.position.x, -seg.position.y, 0);
    const inner = solid(slab(wedge(R * 0.845, R * 0.87, a0, a1), R * 0.04, R * 0.006, 8), kit.brassDk);
    inner.position.set(-seg.position.x, -seg.position.y, R * 0.02);
    seg.add(outer, inner);
    piece(seg);
  }
  // Clock face: a dark glass plate (normal blending) + additive Roman numerals (swept out along with the hands)
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x151b28, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 72), glassMat);
  glass.position.z = -R * 0.03;
  glass.renderOrder = 1;
  body.add(glass);
  const faceMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: dialTex() }, uCol: { value: new THREE.Color(GOLD).multiplyScalar(1.3) }, uA: { value: 0 }, uReveal: { value: 0 }, uT: { value: 0 } },
    vertexShader: flatVert,
    fragmentShader: dialFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.8, R * 1.8), faceMat);
  face.position.z = R * 0.004;
  face.renderOrder = 3;
  body.add(face);
  // Index studs: one o'clock to eleven o'clock (the three, six and nine o'clock ones a size larger)
  const studs: THREE.Object3D[] = [];
  for (let i = 1; i < 12; i++) {
    const a = Math.PI / 2 - (i / 12) * TAU;
    const big = i % 3 === 0;
    const s = new THREE.Group();
    s.position.set(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, R * 0.06);
    s.rotation.z = a - Math.PI / 2;
    s.add(solid(rbox(big ? R * 0.1 : R * 0.07, big ? R * 0.17 : R * 0.12, R * 0.06, R * 0.014, 2), kit.brass));
    studs.push(s);
    piece(s);
  }
  // Twelve o'clock: the sunrise crown ornament (half a sun, nine rays alternating long and short, and a dawn stone)
  const crest = new THREE.Group();
  crest.position.set(0, R * 1.0, R * 0.04);
  const sun = solid(new THREE.CylinderGeometry(R * 0.13, R * 0.13, R * 0.06, 28, 1, false, -Math.PI / 2, Math.PI), kit.brass);
  sun.rotation.x = Math.PI / 2;
  crest.add(sun);
  for (let k = 0; k < 9; k++) {
    const a = -1.25 + (2.5 * k) / 8;
    const long = k % 2 === 0;
    const L = R * (long ? 0.3 : 0.2) * (1 - 0.18 * Math.abs(a));
    const w = R * (long ? 0.045 : 0.032);
    const ray = solid(slab(outline([[-w, 0], [w, 0], [w * 0.55, L * 0.75], [0, L], [-w * 0.55, L * 0.75]]), R * 0.03, R * 0.008, 2), kit.brass);
    ray.position.set(Math.sin(a) * R * 0.14, Math.cos(a) * R * 0.14, 0);
    ray.rotation.z = -a;
    crest.add(ray);
  }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(R * 0.06, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(DAWN).multiplyScalar(1.6), toneMapped: false }));
  gem.position.set(0, R * 0.04, R * 0.05);
  crest.add(gem);
  const gemGlow = glowSprite(glowTex(), DAWN, 1.6);
  gemGlow.position.set(0, R * 0.04, R * 0.1);
  crest.add(gemGlow);
  piece(crest);
  // Hands: spear-shaped brass, with a soft glow underneath; a cap at the center
  const handMesh = (w: number, len: number, z: number) => {
    const grp = new THREE.Group();
    grp.position.z = z;
    grp.add(solid(slab(outline([[-w * 0.55, -R * 0.1], [w * 0.55, -R * 0.1], [w * 0.62, len * 0.62], [0, len], [-w * 0.62, len * 0.62]]), R * 0.03, R * 0.008, 2), kit.brassDk));
    return grp;
  };
  const hour = handMesh(R * 0.085, R * 0.55, R * 0.07);
  const minute = handMesh(R * 0.06, R * 0.8, R * 0.1);
  piece(hour);
  piece(minute);
  const cap = solid(new THREE.CylinderGeometry(R * 0.07, R * 0.07, R * 0.05, 24), kit.brass);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = R * 0.12;
  piece(cap);
  // A faint glow behind the whole clock, so that it floats up out of the cold grey of the time stop
  const halo = glowSprite(glowTex(), GOLD, 0.9);
  halo.scale.setScalar(R * 3.4);
  halo.position.z = -R * 0.2;
  halo.renderOrder = 0;
  body.add(halo);

  const pop = new Array(12).fill(0);
  const clk: BigClock = {
    root,
    st,
    pop,
    hourPos(i) {
      const a = Math.PI / 2 - ((i + 1) / 12) * TAU;
      root.updateMatrixWorld(true);
      return body.localToWorld(new THREE.Vector3(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, R * 0.16));
    },
    kill: () => layer.kill(),
  };
  const ringOut = new THREE.Vector3();
  let lastRt = m.rt;
  const layer = c.sc.vfx.layer(root, () => {
    const dt = Math.min(0.05, Math.max(0, m.rt - lastRt));
    lastRt = m.rt;
    const rise = ease.outCubic(clamp01(st.rise));
    const sink = st.sink;
    root.visible = st.rise > 0.001 && sink < 0.999;
    if (!root.visible) return;
    // Rises from underground, turning into place as it goes; on sinking back it is reversed
    body.position.set(0, -R * 2.1 * (1 - rise) - R * 2.1 * ease.inCubic(sink), 0);
    body.rotation.z = (1 - rise) * 0.5;
    gearG.rotation.z = -m.rt * 0.18 - (1 - rise) * 1.2;
    faceMat.uniforms.uT.value = m.rt;
    faceMat.uniforms.uReveal.value = st.reveal;
    faceMat.uniforms.uA.value = st.face * (1 + st.glow * 0.6) * (1 - st.shatter);
    glassMat.opacity = st.face * 0.5 * (1 - st.shatter);
    (halo.material as THREE.SpriteMaterial).opacity = st.face * (0.22 + st.glow * 0.3) * (1 - st.shatter);
    (gemGlow.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.4 * rise + st.crest);
    gemGlow.scale.setScalar(R * (0.35 + st.crest * 0.8));
    hour.rotation.z = -st.hour * TAU;
    minute.rotation.z = -st.min * TAU;
    for (let i = 0; i < studs.length; i++) {
      // The index studs pop out in sequence (pop), enlarging briefly as they light up
      const k = clamp01(st.rise * 1.6 - (i / 11) * 0.6);
      studs[i].scale.setScalar(Math.max(0.001, ease.outBack(k) * (1 + pop[i + 1] * 0.35)));
    }
    crest.scale.setScalar(Math.max(0.001, ease.outBack(clamp01(st.rise * 1.6 - 0.62)) * (1 + st.crest * 0.25)));
    // Shattering: each piece flies outward and forward, tumbling and falling
    if (st.shatter > 0) {
      for (const p of pieces) {
        const k = st.shatter;
        p.m.position.copy(p.home).addScaledVector(p.v, k).add(ringOut.set(0, -R * 2.2 * k * k, 0));
        p.m.rotation.x += p.w.x * dt;
        p.m.rotation.y += p.w.y * dt;
        if (p.m !== hour && p.m !== minute) p.m.rotation.z += p.w.z * dt;
        p.m.scale.setScalar(Math.max(0.001, 1 - ss(k, 0.55, 1)));
      }
    }
  }, disposeOwn(root, kit));
  registerInkRoot(root);
  m.layers.push(layer);
  return clk;
}

// ───────────────────────── Time marks ─────────────────────────

/** The time marks on the opponent: they emerge around the opponent at the time stop, fly up to the giant clock's index positions, light up when fulfilled, and after the hit rush back at the opponent and burst */
interface Seals {
  n: number;
  s: { show: number; fly: number; lit: number; dive: number; drop: number }[];
  kill(): void;
}
function makeSeals(c: UltCtx, g: Geo, n: number): Seals {
  const m = mem(c);
  const { sc, foe } = c;
  const root = new THREE.Group();
  const cam = sc.stage.camera;
  const list = Array.from({ length: n }, (_, i) => {
    const s = glowSprite(sealTex(), BRONZE, 1.5, false);
    s.renderOrder = 12;
    root.add(s);
    const halo = glowSprite(glowTex(), GOLD, 1.2, false);
    halo.renderOrder = 11;
    root.add(halo);
    return { s, halo, st: { show: 0, fly: 0, lit: 0, dive: 0, drop: 0 }, a: (i / Math.max(1, n)) * TAU + 0.4 };
  });
  const seals: Seals = { n, s: list.map((x) => x.st), kill: () => {} };
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const p = new THREE.Vector3();
  const layer = sc.vfx.layer(root, () => {
    const clk = m.clock;
    const fc = sc.slots[foe].creature;
    const base = (fc?.root.position ?? g.foe).clone();
    const r = g.hf * 0.5 + 0.35;
    list.forEach((x, i) => {
      const st = x.st;
      const vis = st.show > 0.001 && st.dive < 1 && st.drop < 1;
      x.s.visible = x.halo.visible = vis;
      if (!vis) return;
      // Positions around the opponent (the half circle facing the camera, so the opponent does not block them)
      const toCam = cam.position.clone().sub(base).setY(0).normalize();
      const side = new THREE.Vector3().crossVectors(UP, toCam);
      const aa = x.a + m.rt * 0.25;
      from.copy(base).addScaledVector(side, Math.cos(aa) * r).addScaledVector(toCam, 0.3 + Math.abs(Math.sin(aa)) * r * 0.5).setY(g.hf * (0.35 + 0.3 * ((i * 0.37) % 1)));
      p.copy(from);
      if (st.fly > 0 && clk) {
        to.copy(clk.hourPos(i));
        mid.lerpVectors(from, to, 0.5).addScaledVector(UP, g.R * 0.5);
        const k = ease.inOutQuad(clamp01(st.fly));
        p.set(0, 0, 0).addScaledVector(from, (1 - k) * (1 - k)).addScaledVector(mid, 2 * k * (1 - k)).addScaledVector(to, k * k);
        if (st.dive > 0) {
          // Rushing back at the opponent from the index positions
          const d = ease.inQuad(clamp01(st.dive));
          p.lerp(sc.center(foe), d);
        }
      }
      if (st.drop > 0) p.addScaledVector(UP, -g.R * 1.4 * st.drop * st.drop);
      x.s.position.copy(p);
      x.halo.position.copy(p);
      const size = THREE.MathUtils.lerp(g.hf * 0.2 + 0.2, g.R * 0.26, clamp01(st.fly)) * (1 + st.lit * 0.25);
      x.s.scale.setScalar(size * (0.6 + 0.4 * ease.outBack(clamp01(st.show))));
      x.halo.scale.setScalar(size * (1.3 + st.lit * 0.5));
      const col = (x.s.material as THREE.SpriteMaterial).color;
      col.set(BRONZE).lerp(new THREE.Color(GOLD), st.lit).multiplyScalar(1.25 + st.lit * 0.45);
      (x.s.material as THREE.SpriteMaterial).opacity = clamp01(st.show) * (1 - st.drop);
      (x.s.material as THREE.SpriteMaterial).rotation = st.drop * 2.5;
      (x.halo.material as THREE.SpriteMaterial).opacity = clamp01(st.show) * (0.12 + st.lit * 0.28) * (1 - st.drop);
    });
  });
  m.layers.push(layer);
  seals.kill = () => layer.kill();
  return seals;
}

// ───────────────────────── Torrent of time sand ─────────────────────────

const sandFrag = /* glsl */ `
  uniform vec3 uDark; uniform vec3 uLight; uniform float uFlow; uniform float uA; uniform float uGrow; uniform float uTail;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float grain(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  void main(){
    float y = vUv.y;
    if (y > uGrow || y < uTail) discard;
    float f = abs(dot(normalize(vN), normalize(vV)));
    float g1 = grain(vec2(vUv.x * 18.0, y * 60.0 - uFlow * 9.0));
    float g2 = grain(vec2(vUv.x * 44.0 + 3.0, y * 150.0 - uFlow * 14.0));
    float g = g1 * 0.65 + g2 * 0.35;
    float body = smoothstep(0.05, 0.6, f);
    float front = smoothstep(uGrow, uGrow - 0.05, y) * smoothstep(uTail, uTail + 0.05, y);
    float a = body * (0.55 + 0.45 * g) * uA * front;
    float hi = smoothstep(0.5, 0.85, g);
    vec3 col = mix(uDark, uLight, hi * (0.4 + 0.6 * f)) * (1.0 + hi * 0.5);
    gl_FragColor = vec4(col, a);
  }`;
const sandVert = /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

const coreFrag = /* glsl */ `
  uniform vec3 uCol; uniform float uA; uniform float uGrow; uniform float uTail; uniform float uT;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){
    float y = vUv.y;
    if (y > uGrow || y < uTail) discard;
    float f = abs(dot(normalize(vN), normalize(vV)));
    float core = pow(max(f, 0.0), 1.5);
    float streak = 0.7 + 0.3 * sin(y * 90.0 - uT * 30.0 + vUv.x * 6.2831853);
    float front = smoothstep(uGrow, uGrow - 0.04, y) * smoothstep(uTail, uTail + 0.06, y);
    float head = exp(-abs(y - uGrow) * 30.0) * step(uGrow, 0.999);
    float a = (core * streak * 0.8 + head * 1.4) * front * uA;
    gl_FragColor = vec4(uCol * a, a);
  }`;

const grainVert = /* glsl */ `
  attribute float aU; attribute float aSize; attribute vec3 aDir;
  uniform float uGrow; uniform float uSurge; uniform float uScale;
  varying float vA;
  void main(){
    vec3 p = position + aDir * uSurge;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float on = step(aU, uGrow);
    vA = on * (1.0 - smoothstep(0.7, 1.0, uSurge));
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1) * on;
  }`;
const grainFrag = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uCol; uniform float uA;
  varying float vA;
  void main(){
    vec4 t = texture2D(uMap, gl_PointCoord);
    float a = t.a * vA * uA;
    gl_FragColor = vec4(uCol * t.rgb * a, a);
  }`;

/** Time sand surging from the hourglass toward the opponent: a sand stream twisted from three spirals, a golden beam in the middle, sand chunks and grains; grow extends it forward, and on surge everything rushes into the opponent together */
interface Torrent {
  st: { grow: number; surge: number; fade: number; tail: number };
  path: THREE.Curve<THREE.Vector3>;
  kill(): void;
}
function makeTorrent(c: UltCtx, g: Geo, kit: Kit, from: THREE.Vector3, to: THREE.Vector3): Torrent {
  const m = mem(c);
  const lo = low(c);
  const { h } = g;
  const len = from.distanceTo(to);
  const mid = from.clone().lerp(to, 0.45).addScaledVector(UP, len * 0.16).addScaledVector(g.a, len * 0.06);
  const path = new THREE.QuadraticBezierCurve3(from, mid, to);
  const st = { grow: 0, surge: 0, fade: 0, tail: 0 };
  const root = new THREE.Group();
  // The frame of the spiral: the normal along the path (leaning up) and the binormal
  const frame = (u: number) => {
    const t = path.getTangentAt(Math.min(0.999, Math.max(0.001, u))).normalize();
    const n = UP.clone().addScaledVector(t, -t.y).normalize();
    const b = new THREE.Vector3().crossVectors(t, n).normalize();
    return { t, n, b };
  };
  const swirl = (u: number) => h * (0.03 + 0.2 * Math.pow(Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.92), 0.8));
  const TURNS = 2.4;
  const helix = (u: number, ph: number, rMul = 1) => {
    const { n, b } = frame(u);
    const th = u * TURNS * TAU + ph;
    return path.getPointAt(u).addScaledVector(n, Math.cos(th) * swirl(u) * rMul).addScaledVector(b, Math.sin(th) * swirl(u) * rMul);
  };
  const sandMats: THREE.ShaderMaterial[] = [];
  const NS = 3;
  for (let k = 0; k < NS; k++) {
    const pts = Array.from({ length: 72 }, (_, i) => helix(i / 71, (k / NS) * TAU));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 110, 1, lo ? 6 : 9, false);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i);
      const cp = curve.getPointAt(Math.min(1, u));
      tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(cp);
      const rr = h * (0.022 + 0.07 * Math.pow(Math.sin(Math.min(1, u * 1.1) * Math.PI * 0.9), 0.7)) * (1 + 0.25 * Math.sin(u * 40 + k));
      tmp.multiplyScalar(rr).add(cp);
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
      uv.setXY(i, uv.getY(i), u);
    }
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uDark: { value: new THREE.Color(0x96662a) }, uLight: { value: new THREE.Color(0xffe2a0) }, uFlow: { value: k * 1.3 }, uA: { value: 0.92 }, uGrow: { value: 0 }, uTail: { value: 0 } },
      vertexShader: sandVert,
      fragmentShader: sandFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    mat.userData.flow0 = k * 1.3;
    sandMats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 4;
    root.add(mesh);
  }
  // A golden beam in the middle
  const coreGeo = new THREE.TubeGeometry(path, 80, h * 0.05, 10, false);
  {
    const uv = coreGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  }
  const coreMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(GOLD).multiplyScalar(0.95) }, uA: { value: 1 }, uGrow: { value: 0 }, uTail: { value: 0 }, uT: { value: 0 } },
    vertexShader: sandVert,
    fragmentShader: coreFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.renderOrder = 5;
  root.add(core);
  // Sand chunks: solid, outlined, scattering along the spiral, suspended during the time stop, rushing into the opponent when time flows back
  const NC = lo ? 16 : 30;
  const clumps = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), kit.sand, NC);
  clumps.layers.enable(INK_LAYER);
  clumps.userData.inkScene = true;
  clumps.userData.inkHeavy = true;
  clumps.frustumCulled = false;
  const cu = Array.from({ length: NC }, (_, i) => ({ u: 0.06 + (i / NC) * 0.9 + hash(i) * 0.03, ph: hash(i * 3.3) * TAU, r: 0.6 + hash(i * 5.1) * 0.8, s: h * (0.016 + hash(i * 7.9) * 0.022), spin: new THREE.Vector3(hash(i), hash(i + 1), hash(i + 2)).subScalar(0.5).multiplyScalar(4) }));
  root.add(clumps);
  // Sand grains: additive points, scattered along the spiral; when time flows back they fly forward along the tangent
  const NG = lo ? 260 : 620;
  const gpos = new Float32Array(NG * 3);
  const gdir = new Float32Array(NG * 3);
  const gu = new Float32Array(NG);
  const gsize = new Float32Array(NG);
  for (let i = 0; i < NG; i++) {
    const u = hash(i * 1.7) * 0.98;
    const p = helix(u, hash(i * 2.3) * TAU, 0.3 + hash(i * 4.4) * 1.3).add(new THREE.Vector3(hash(i * 5.5) - 0.5, hash(i * 6.6) - 0.5, hash(i * 7.7) - 0.5).multiplyScalar(h * 0.08));
    gpos.set([p.x, p.y, p.z], i * 3);
    const t = path.getTangentAt(Math.min(0.999, u + 0.02));
    const run = to.distanceTo(p) * (0.9 + hash(i * 8.8) * 0.4);
    gdir.set([t.x * run, t.y * run, t.z * run], i * 3);
    gu[i] = u;
    gsize[i] = h * (0.02 + hash(i * 9.9) * 0.035);
  }
  const ggeo = new THREE.BufferGeometry();
  ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  ggeo.setAttribute('aDir', new THREE.BufferAttribute(gdir, 3));
  ggeo.setAttribute('aU', new THREE.BufferAttribute(gu, 1));
  ggeo.setAttribute('aSize', new THREE.BufferAttribute(gsize, 1));
  const gmat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: glowTex() }, uCol: { value: new THREE.Color(GOLD).multiplyScalar(1.3) }, uA: { value: 1 }, uGrow: { value: 0 }, uSurge: { value: 0 }, uScale: { value: 1 } },
    vertexShader: grainVert,
    fragmentShader: grainFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const grains = new THREE.Points(ggeo, gmat);
  grains.frustumCulled = false;
  grains.renderOrder = 9;
  root.add(grains);

  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sv = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const layer = c.sc.vfx.layer(root, () => {
    const grow = st.grow;
    const surge = st.surge;
    const fade = 1 - st.fade;
    const tail = Math.max(st.tail, surge * 1.05);
    for (const mat of sandMats) {
      mat.uniforms.uGrow.value = grow + surge * 0.2;
      mat.uniforms.uTail.value = tail;
      mat.uniforms.uFlow.value = (mat.userData.flow0 as number) + surge * 3 + grow * 0.4;
      mat.uniforms.uA.value = 0.92 * fade;
    }
    coreMat.uniforms.uGrow.value = grow + surge * 0.2;
    coreMat.uniforms.uTail.value = tail;
    coreMat.uniforms.uT.value = m.rt;
    coreMat.uniforms.uA.value = fade;
    const cam = c.sc.stage.camera;
    gmat.uniforms.uScale.value = c.sc.stage.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    gmat.uniforms.uGrow.value = grow;
    gmat.uniforms.uSurge.value = surge;
    gmat.uniforms.uA.value = fade;
    for (let i = 0; i < NC; i++) {
      const x = cu[i];
      const on = x.u < grow ? ease.outBack(clamp01((grow - x.u) * 8)) : 0;
      // When time flows back they rush forward along the path and shrink away on the opponent
      const u = Math.min(1, x.u + surge * (1.05 - x.u) * 1.2);
      pv.copy(helix(u, x.ph, x.r * (1 - surge * 0.7)));
      const s = x.s * on * (1 - ss(u, 0.92, 1) * ss(surge, 0.01, 0.2)) * fade;
      e.set(x.spin.x * (m.rt + i), x.spin.y * (m.rt + i), x.spin.z * (m.rt + i));
      q.setFromEuler(e);
      mtx.compose(pv, q, sv.setScalar(Math.max(1e-4, s)));
      clumps.setMatrixAt(i, mtx);
    }
    clumps.instanceMatrix.needsUpdate = true;
  }, disposeOwn(root, kit));
  registerInkRoot(root);
  m.layers.push(layer);
  return { st, path, kill: () => layer.kill() };
}

// ───────────────────────── Sound effects ─────────────────────────

/** Second hand: one short "click" (a recording of a pocket watch; synthesized if not available) */
function tick(gain = 0.16, pitch = 1, delay = 0): void {
  playOr(tickUrl, () => {
    synth.noise({ type: 'bandpass', f0: 3400 * pitch, q: 9, dur: 0.028, gain, delay });
    synth.tone({ type: 'triangle', f0: 1500 * pitch, f1: 900 * pitch, dur: 0.035, gain: gain * 0.45, delay });
  }, { gain: gain * 3, rate: pitch, delay });
}

/** Time mark lighting up: a clear bell stroke, each higher than the last */
function chime(i: number, gain = 0.55): void {
  const up = Math.pow(2, (i * 3) / 12);
  const f = 880 * up;
  playOr(chimeUrl, () => {
    synth.tone({ type: 'triangle', f0: f, dur: 0.7, gain: 0.09 });
    synth.tone({ type: 'sine', f0: f * 2.01, dur: 0.5, gain: 0.04, delay: 0.01 });
    synth.noise({ type: 'highpass', f0: 6000, dur: 0.05, gain: 0.08 });
  }, { gain, rate: up });
}

/** Ratchet catching a notch: a heavy brass winding key */
function windClick(i: number): void {
  playOr(windUrl, () => {
    synth.noise({ type: 'bandpass', f0: 1600, q: 4, dur: 0.05, gain: 0.3 });
    synth.tone({ type: 'square', f0: 180, f1: 90, dur: 0.08, gain: 0.08 });
  }, { gain: 1.1, rate: 1 - i * 0.06 });
  synth.tone({ type: 'sine', f0: 70 - i * 6, f1: 40, dur: 0.3, gain: 0.25 });
}

/** The "thud" of the time stop (one stroke of the great bell) + ear-ringing-like highs and an extremely low hum */
function stopSound(): void {
  ultSfx.thump(0.8);
  playOr(tollUrl, () => synth.noise({ type: 'lowpass', f0: 600, f1: 60, dur: 0.5, gain: 0.5 }), { gain: 1.15 });
  synth.tone({ type: 'sine', f0: 5200, dur: 2.2, gain: 0.022, attack: 0.02 });
  synth.tone({ type: 'sine', f0: 38, dur: 2.4, gain: 0.16, attack: 0.3 });
}

/** Time flows back: all the clocks tick one notch together, sand and brass shatter together */
function resumeSound(): void {
  for (let i = 0; i < 7; i++) tick(0.14, 0.8 + i * 0.12, i * 0.018);
  sfx.impactBig();
  playOr(shatterUrl, () => {
    synth.noise({ type: 'lowpass', f0: 5000, f1: 500, dur: 0.9, gain: 0.4 });
    synth.noise({ type: 'bandpass', f0: 1800, f1: 400, q: 1.5, dur: 0.5, gain: 0.3 });
  }, { gain: 0.9 });
  playOr(sandUrl, () => synth.noise({ type: 'lowpass', f0: 2600, f1: 300, dur: 0.6, gain: 0.3 }), { gain: 0.7 });
  synth.tone({ type: 'sine', f0: 60, f1: 30, dur: 0.8, gain: 0.4 });
}

// ───────────────────────── Cinematic ─────────────────────────

/** Announcement → the index studs light up one by one → winding the spring → the clock wakes → tossing up and flipping the hourglass */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side } = c;
  const m = mem(c);
  const g = geometry(c);
  m.g = g;
  const h = g.h;
  const A = act(c);
  const lo = low(c);
  const port = sc.portrait;
  const active = c.view.sides[side].team[c.view.sides[side].active];
  const mark = active?.marks.find((x) => x.id === 'kit:seal');
  m.n = Math.min(5, mark?.n ?? 0);
  m.turns = Math.max(1, Math.min(3, mark?.turns ?? 1));
  startClock(c);

  // Build all of this move's objects first (the giant clock underground, the sand stream's material compiled with a fake path), and compile the shaders before the announcement
  const kit = makeKit(c);
  m.kit = kit;
  m.flares = makeFlares(c);
  m.studs = makeStuds(c, h);
  m.springs = makeSprings(c, h);
  m.clock = makeClock(c, g, kit);
  m.seals = makeSeals(c, g, m.n);
  const warm = makeTorrent(c, g, kit, g.home.clone().setY(-30), g.home.clone().setY(-29));
  warm.st.grow = 1;
  sc.stage.prewarm();
  warm.kill();

  const face = () => anchorPos(c, 'head', () => sc.head(side));
  const spiral = () => anchorPos(c, 'spiral', () => sc.center(side));
  const keyAt = () => anchorPos(c, 'key', () => sc.head(side).addScaledVector(g.f, -h * 0.25).addScaledVector(UP, h * 0.1));
  const keyBase = () => anchorPos(c, 'keyBase', keyAt);
  const clockAt = () => anchorPos(c, g.side, () => sc.center(side));
  const hgAt = () => anchorPos(c, 'hourglass', () => face().addScaledVector(UP, h * 0.3));
  const face0 = face();
  const tl = sc.gs.timeline('world');

  // ① Announcement: warm gold tint; the camera pressed below the face, shooting up at the face framed by the bezel
  const push = { k: 0 };
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    synth.dropMusic();
    synth.noise({ type: 'bandpass', f0: 300, f1: 1200, q: 0.8, dur: 0.9, gain: 0.16, attack: 0.6 });
    synth.tone({ type: 'sine', f0: 55, f1: 49, dur: 1.2, gain: 0.22, attack: 0.3 });
    const fov = port ? 1.35 : 1.2;
    void cine.look({ letterbox: 1, vignette: 0.55, desat: 0, tint: WARM, lift: 0x000000, bloom: 0.6, fov }, 0.4, ease.outQuad);
    cine.track(face, ['vig', 'radial']);
    const camA = cine.orbitPos(side, face0, 36, h * 0.95, -h * 0.24);
    const camB = cine.orbitPos(side, face0, 22, h * 0.74, -h * 0.26);
    // The look-at point is pressed a little below the face: the face and crown ornament in the upper middle of the frame, the name banner below
    const aim = () => face().addScaledVector(UP, -h * 0.03);
    cine.cut(camA, aim());
    ride(c, (pos, look) => {
      pos.lerpVectors(camA, camB, ease.outQuad(push.k));
      look.copy(aim());
    });
  }, [], 0);
  tl.to(push, { k: 1, duration: W.key, ease: 'none' }, 0);
  tl.to(A, { focus: 1, duration: 0.3, ease: 'power2.out' }, 0);
  tl.to(A, { peer: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.08);
  // The index studs light up clockwise one by one from one o'clock, the crown ornament at twelve last
  for (let j = 0; j < 12; j++) {
    const i = (j + 1) % 12;
    const at = j < 11 ? W.stud0 + j * W.studGap : W.crest;
    tl.call(() => {
      const s = m.studs!;
      s.pop[i] = 1;
      tick(0.12 + j * 0.008, 1 + j * 0.04);
      if (i === 0) {
        m.flares?.at(() => anchorPos(c, 'crest', face), DAWN, h * 0.34, 0.5);
        synth.tone({ type: 'triangle', f0: 1760, dur: 0.6, gain: 0.06 });
      }
    }, [], at);
    tl.to(m.studs!.pop, { [i]: 0, duration: 0.3, ease: 'power2.out' }, at + 0.02);
    tl.to(m.studs!.lit, { [i]: 1, duration: 0.12, ease: 'power2.out' }, at);
  }
  tl.to(A, { bezel: 1, duration: W.crest, ease: 'power1.in' }, W.stud0);
  tl.to(A, { glow: 0.6, duration: 0.3, ease: 'power2.out' }, W.crest);
  tl.call(() => eyeGlint(c, GOLD_HI, 0.9), [], W.glint);

  // ② Winding the spring (cut): behind and above the shell, the key shaft in the foreground; orbiting around the spiral's core to the side, bringing the clock face on the audience side into the frame
  const orb = { k: 0 };
  tl.call(() => {
    void cine.look({ fov: port ? 1.3 : 1.15, vignette: 0.5 }, 0);
    const sp0 = spiral();
    const fov = port ? 1.3 : 1.15;
    const d0 = fitDist(c, h * 1.25, h * 1.3, fov);
    const lk = new THREE.Vector3();
    const place = (pos: THREE.Vector3, look: THREE.Vector3) => {
      const k = ease.inOutQuad(orb.k);
      pos.copy(cine.orbitPos(side, sp0, 150 - 50 * k, d0 * (0.95 - 0.08 * k), h * (0.55 - 0.37 * k)));
      look.copy(keyAt()).lerp(lk.copy(clockAt()).addScaledVector(UP, h * 0.12), ease.inOutQuad(clamp01(orb.k * 1.2 - 0.1)));
    };
    const p = new THREE.Vector3();
    const l = new THREE.Vector3();
    place(p, l);
    cine.cut(p, l);
    ride(c, place);
    cine.track(keyAt, ['vig']);
    if (m.springs) m.springs.a = 0;
  }, [], W.key);
  tl.to(orb, { k: 1, duration: W.hg - W.key, ease: 'none' }, W.key);
  W.clicks.forEach((t, i) => {
    tl.to(A, { wind: (i + 1) * 0.5, duration: 0.12, ease: 'power3.in' }, t - 0.12);
    tl.set(A, { jolt: 1 }, t);
    tl.to(A, { jolt: 0, duration: 0.2, ease: 'power2.out' }, t + 0.02);
    tl.to(A, { hands: (i + 1) * 0.02, duration: 0.1, ease: 'back.out(3)' }, t);
    if (m.springs) {
      tl.to(m.springs, { a: 0.65 + i * 0.18, duration: 0.08, ease: 'power2.out' }, t);
      tl.to(m.springs, { k: (i + 1) / 3, duration: 0.14, ease: 'back.out(2)' }, t);
    }
    tl.call(() => {
      windClick(i);
      sc.rig.addTrauma(0.1 + i * 0.03);
      const kb = keyBase();
      const axis = keyAt().sub(kb).normalize();
      sc.vfx.emit({ pos: kb, count: lo ? 8 : 16, color: [GOLD_HI, GOLD, 0xffd890], speed: [1.5, 3.5], dir: axis, spread: 0.9, life: [0.25, 0.5], size: [0.03, 0.06], sizeEnd: 0.2, gravity: 6, drag: 1.5, intensity: 1 });
      sc.vfx.smoke({ pos: kb, count: lo ? 4 : 8, color: [SAND, SAND_LT, SAND_DK], speed: [0.4, 1.2], dir: axis, spread: 0.8, life: [0.5, 0.9], size: [0.08, 0.16], sizeEnd: 1.6, radius: h * 0.03, gravity: -0.2, drag: 1.6 });
      void sc.vfx.ring(kb.clone().addScaledVector(axis, h * 0.02), GOLD, h * 0.03, h * (0.16 + i * 0.03), 0.35, axis);
      m.flares?.at(clockAt(), GOLD_HI, h * 0.14, 0.28);
    }, [], t);
  });

  // ③ The clock wakes: the hands that stood still for a thousand years move for the first time, faster and faster; the clock face gives off a warm glow
  tl.call(() => {
    for (let i = 0; i < 9; i++) tick(0.1 + i * 0.012, 0.9 + i * 0.05, 0.02 + i * (0.075 - i * 0.004));
    m.flares?.at(clockAt(), GOLD_HI, h * 0.22, 0.4);
  }, [], W.wake);
  tl.to(A, { hands: 0.5, duration: W.end - W.wake, ease: 'power2.in' }, W.wake);
  tl.to(A, { dial: 1, duration: 0.3, ease: 'power2.out' }, W.wake);

  // ④ Tossing the hourglass (cut): a low angle from the front toward the audience side; the tentacle raises and tosses it, and the hourglass flips beside the crown ornament
  const hgPush = { k: 0 };
  tl.call(() => {
    const fov = port ? 1.35 : 1.18;
    void cine.look({ fov, vignette: 0.55 }, 0);
    const f1 = face();
    const camA = cine.orbitPos(side, f1, 24, h * 1.4, -h * 0.1);
    const camB = cine.orbitPos(side, f1, 14, h * 1.26, -h * 0.13);
    const lk = f1.clone().addScaledVector(UP, h * 0.18);
    const aim = new THREE.Vector3();
    cine.cut(camA, lk);
    ride(c, (pos, look) => {
      pos.lerpVectors(camA, camB, ease.outQuad(hgPush.k));
      // The look-at point is between the face and the hourglass, following the tossed hourglass upward
      aim.copy(face()).lerp(hgAt(), 0.5);
      look.copy(lk).lerp(aim, ss(hgPush.k, 0.05, 0.5));
    });
    cine.track(hgAt, ['vig']);
    playOr(flipUrl, () => synth.noise({ type: 'highpass', f0: 2000, f1: 6000, dur: 0.25, gain: 0.12, attack: 0.1 }), { gain: 0.9, peakIn: W.flip - W.hg });
    sfx.whoosh(1.2);
  }, [], W.hg);
  tl.to(hgPush, { k: 1, duration: W.end - W.hg, ease: 'none' }, W.hg);
  tl.to(A, { lift: 1, duration: 0.18, ease: 'power2.out' }, W.hg);
  tl.to(A, { toss: 1, duration: 0.26, ease: 'power2.out' }, W.toss);
  tl.to(A, { flip: 3, duration: W.flipDur, ease: 'power2.out' }, W.flip);
  tl.to(A, { glow: 1, duration: 0.25, ease: 'power1.in' }, W.flip);
  tl.to(A, { lift: 0.55, duration: 0.3, ease: 'power1.inOut' }, W.flip);
  // Sand scattering as the hourglass flies up, and the sand grains and light specks thrown up before the time stop (hanging in midair at the time stop)
  tl.call(() => {
    let tt = 0;
    const trail = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      tt += dt;
      if (tt > W.end - W.toss) return trail.kill();
      sc.vfx.emit({ pos: hgAt(), count: lo ? 1 : 3, color: [GOLD_HI, SAND_LT, GOLD], speed: [0.3, 1.2], life: [0.6, 1.2], size: [0.02, 0.05], sizeEnd: 0.4, radius: h * 0.05, gravity: 1.5, drag: 0.8, intensity: 0.9 });
    });
    m.layers.push(trail);
  }, [], W.toss);
  tl.call(() => {
    const hg = hgAt();
    // At the instant the hourglass turns over, a ring of sand bursts out of the glass
    sc.vfx.emit({ pos: hg, count: lo ? 24 : 60, color: [GOLD_HI, SAND_LT, GOLD], speed: [1.2, 3.2], life: [3, 4], size: [0.025, 0.06], radius: h * 0.05, drag: 0.6, intensity: 0.95 });
    // Sand thrown up from the ground on both sides and light specks drifting in the air
    for (const [p, hh] of [[g.home, h], [g.foe, g.hf]] as [THREE.Vector3, number][]) {
      sc.vfx.smoke({ pos: p.clone().setY(0.15), count: lo ? 6 : 14, color: [SAND, SAND_LT, SAND_DK], speed: [0.6, 1.6], dir: UP, spread: 0.7, life: [3, 4], size: [0.12, 0.24], sizeEnd: 1.6, radius: hh * 0.5, gravity: -0.3, drag: 1 });
      sc.vfx.emit({ pos: p.clone().setY(hh * 0.4), count: lo ? 16 : 40, color: [SAND_LT, GOLD, GOLD_HI], speed: [0.3, 1.2], life: [3, 4], size: [0.025, 0.055], radius: hh * 0.9, gravity: -0.3, drag: 0.4, intensity: 0.85 });
    }
    for (let i = 0; i < (lo ? 8 : 18); i++) {
      const p = g.home.clone().lerp(g.foe, 0.15 + hash(i * 3.7) * 0.7).addScaledVector(g.a, (hash(i * 5.1) - 0.3) * 3).setY(0.3 + hash(i * 1.9) * 2.4);
      sc.vfx.emit({ pos: p, count: 3, color: [SAND_LT, GOLD_HI], speed: [0.3, 0.9], life: [3, 4], size: [0.02, 0.045], radius: 0.4, drag: 0.4, intensity: 0.8 });
    }
  }, [], W.end - 0.1);
  tl.set({}, {}, W.end);
  await playTimeline(tl);
}

/** Time stop → the giant clock rises, time marks set onto the index positions, fast-forward to twelve → release the spring, time sand surges out, stopping in front of the opponent → time flows back */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const g = m.g ?? geometry(c);
  m.g = g;
  const h = g.h;
  const A = act(c);
  const lo = low(c);
  const port = sc.portrait;
  if (!m.offs.length) startClock(c);
  const face = () => anchorPos(c, 'head', () => sc.head(side));
  const spiral = () => anchorPos(c, 'spiral', () => sc.center(side));
  const hgAt = () => anchorPos(c, 'hourglass', () => face().addScaledVector(UP, h * 0.3));
  const clockAt = () => anchorPos(c, g.side, () => sc.center(side));
  const flares = m.flares ?? (m.flares = makeFlares(c));

  // ① Time stop: the world stops and fades to cold grey; a ring of time wave sweeps out from the hourglass
  freeze(c);
  stopSound();
  cine.invertFlash(0.03);
  sc.rig.addTrauma(0.3);
  const hg0 = hgAt();
  cine.shock(hg0, 0.9, 0.7, 1.2);
  flares.at(hg0, GOLD_HI, h * 0.5, 0.5);
  const wave = makeWave(c, hg0, h, lo);
  const tl = realTimeline(c);
  const base: Look = { desat: 0, isolate: 0, tint: WARM, lift: 0x000000, grain: 0, vignette: 0.55, bloom: 0.6 };
  const stopped: Look = { desat: 0.9, isolate: 0.85, tint: COLD, lift: 0x06080e, grain: lo ? 0 : 0.14, vignette: 0.62, bloom: 0.5 };
  rlook(c, tl, base, stopped, 0.12, 0, 'power2.out');
  cine.track(spiral, ['vig']);
  tl.to(wave, { k: 1, duration: 0.7, ease: 'none' }, 0);

  // Camera: orbiting 85° around Chronos from the hourglass shot's position, the sand grains suspended in midair sliding past in front of the lens
  const orbit = { k: 0 };
  const sp0 = spiral();
  const fovO = port ? 1.3 : 1.15;
  const dO = fitDist(c, h * 1.35, h * 1.6, fovO);
  const lookO = sp0.clone().addScaledVector(UP, h * 0.16);
  const startPos = sc.rig.pos.clone();
  const startLook = sc.rig.look.clone();
  ride(c, (pos, look) => {
    const k = ease.inOutQuad(orbit.k);
    const b = ss(orbit.k, 0, 0.35);
    pos.copy(cine.orbitPos(side, sp0, 12 + 85 * k, THREE.MathUtils.lerp(dO * 0.85, dO, k), h * (0.05 + 0.25 * k))).lerp(startPos, 1 - b);
    look.copy(lookO).lerp(startLook, 1 - b);
  });
  tl.to(orbit, { k: 1, duration: D.orbitDur, ease: 'none' }, 0);
  rlook(c, tl, { fov: port ? 1.35 : 1.18 }, { fov: fovO }, D.orbitDur, 0);
  // Only it is still moving: the clocks on both sides race, and the bezel and clock face stay lit
  tl.to(A, { hands: 3.5, duration: D.release - 0.05, ease: 'power1.in' }, 0);
  tl.call(() => synth.tone({ type: 'sine', f0: 1600, f1: 2400, dur: 0.6, gain: 0.025, attack: 0.3 }), [], 0.05);
  for (let i = 0; i < 4; i++) tl.call(() => tick(0.12, 0.55, 0), [], 0.12 + i * 0.13);

  // ② Heaven's Clock (cut to the target's view): the giant clock rises behind the opponent; the time marks fly up to the index positions
  const clk = m.clock!;
  const clockPush = { k: 0 };
  tl.call(() => {
    const fov = port ? 1.35 : 1.2;
    void cine.look({ fov }, 0);
    const foeC = sc.center(foe);
    // The whole clock (including the crown ornament at twelve) and the opponent in front must both be in frame: the look-at point is at the clock's center, shifted slightly toward the opponent and downward
    const L = g.clockC.clone().lerp(foeC, 0.22).setY(g.R * 1.02);
    const d = fitDist(c, g.R * 2.8, g.R * 3.0, fov);
    const p0 = L.clone().addScaledVector(g.clockN, d * 1.1).addScaledVector(UP, g.hf * 0.12);
    const p1 = L.clone().addScaledVector(g.clockN, d * 0.99).addScaledVector(UP, g.hf * 0.08);
    cine.cut(p0, L);
    ride(c, (pos, look) => {
      pos.lerpVectors(p0, p1, ease.outQuad(clockPush.k));
      look.copy(L);
    });
    cine.track(() => g.clockC, ['vig']);
    playOr(clockUrl, () => {
      for (let i = 0; i < 6; i++) synth.noise({ type: 'bandpass', f0: 500 + i * 80, q: 6, dur: 0.06, gain: 0.18, delay: i * 0.06 });
      synth.tone({ type: 'sine', f0: 70, f1: 45, dur: 0.6, gain: 0.3 });
    }, { gain: 1 });
    synth.tone({ type: 'sine', f0: 48, dur: 1.0, gain: 0.2, attack: 0.1 });
    sc.rig.addTrauma(0.25);
  }, [], D.clock);
  // The time marks emerge on the opponent
  m.seals?.s.forEach((s, i) => tl.to(s, { show: 1, duration: 0.2, ease: 'power2.out' }, D.clock + i * 0.03));
  rlook(c, tl, stopped, { isolate: 0.7, desat: 0.86 }, 0.1, D.clock);
  tl.to(clockPush, { k: 1, duration: D.release - D.clock, ease: 'none' }, D.clock);
  tl.to(clk.st, { rise: 1, duration: D.rise, ease: 'power2.out' }, D.clock);
  tl.to(clk.st, { face: 1, duration: 0.3, ease: 'power1.out' }, D.clock + 0.15);
  tl.to(clk.st, { reveal: 1, duration: 0.45, ease: 'power1.inOut' }, D.clock + 0.18);
  tl.set(clk.st, { min: -0.25, hour: -0.05 }, D.clock);
  tl.to(clk.st, { min: 0, hour: 0, duration: D.rise + 0.05, ease: 'back.out(1.4)' }, D.clock);
  tl.call(() => flares.at(() => clk.hourPos(-1), DAWN, g.R * 0.45, 0.45), [], D.clock + D.rise * 0.85);
  // The time marks fly one by one onto the index positions starting from one o'clock
  m.seals?.s.forEach((s, i) => {
    const t = D.seals + i * 0.05;
    tl.to(s, { fly: 1, duration: 0.26, ease: 'none' }, t);
    tl.call(() => {
      synth.tone({ type: 'triangle', f0: 1200 + i * 150, f1: 1800 + i * 150, dur: 0.18, gain: 0.03 });
      flares.at(clk.hourPos(i), GOLD, g.R * 0.2, 0.3);
    }, [], t + 0.26);
  });

  // ③ Fast-forward: the hands spin wildly, the remaining countdown turns run through lap after lap, and the time marks the minute hand sweeps past light up in order
  const turns = m.turns;
  tl.call(() => {
    playOr(ffUrl, () => {
      for (let i = 1; i <= 26; i++) tick(0.06 + (i / 26) * 0.1, 0.9 + (i / 26) * 0.6, D.ffDur * Math.sqrt(i / 26));
    }, { gain: 0.8, rate: 1.25 });
    for (let i = 1; i <= 14; i++) tick(0.05 + (i / 14) * 0.08, 1 + (i / 14) * 0.5, D.ffDur * Math.sqrt(i / 14));
    synth.noise({ type: 'bandpass', f0: 1200, f1: 5200, q: 3, dur: D.ffDur, gain: 0.12, attack: D.ffDur * 0.9 });
    synth.tone({ type: 'sawtooth', f0: 55, f1: 165, dur: D.ffDur + 0.1, gain: 0.05, attack: D.ffDur * 0.8 });
  }, [], D.ff);
  tl.to(clk.st, { min: turns, hour: turns / 12, duration: D.ffDur, ease: 'power2.in' }, D.ff);
  tl.to(clk.st, { glow: 1, duration: D.ffDur, ease: 'power1.in' }, D.ff);
  // The moment the minute hand sweeps past the i-th time mark ((i + 1) o'clock) on the last lap: solve power2.in's k² = (turns − 1 + (i + 1) / 12) / turns
  m.seals?.s.forEach((s, i) => {
    const t = D.ff + D.ffDur * Math.sqrt((turns - 1 + (i + 1) / 12) / turns);
    tl.to(s, { lit: 1, duration: 0.08, ease: 'power2.out' }, t);
    tl.set(clk.pop, { [i + 1]: 1 }, t);
    tl.to(clk.pop, { [i + 1]: 0, duration: 0.25, ease: 'power2.out' }, t + 0.01);
    tl.call(() => {
      chime(i, 0.5);
      flares.at(clk.hourPos(i), GOLD_HI, g.R * 0.32, 0.4);
      sc.rig.addTrauma(0.08);
    }, [], t);
  });

  // ④ Twelve o'clock: the two hands stop at twelve, the crown ornament flashes
  tl.call(() => {
    playOr(chimeUrl, () => synth.tone({ type: 'triangle', f0: 440, dur: 1.2, gain: 0.12 }), { gain: 0.9, rate: 0.5 });
    ultSfx.thump(0.45);
    sc.rig.addTrauma(0.2);
    flares.at(() => clk.hourPos(-1), DAWN, g.R * 0.7, 0.55);
    cine.shock(clk.hourPos(-1), 0.5, 0.5, 0.7);
  }, [], D.twelve);
  tl.to(clk.st, { crest: 1, duration: 0.06 }, D.twelve);
  tl.to(clk.st, { crest: 0.3, duration: 0.5, ease: 'power2.out' }, D.twelve + 0.08);

  // ⑤ Releasing the spring (cut): the audience side close to Chronos; the key turns back to release, the hands run backward to their original place; time sand surges out of the inverted hourglass
  const run = { u: 0, pre: 0 };
  tl.call(() => {
    const fov = port ? 1.35 : 1.2;
    void cine.look({ fov, roll: 0 }, 0);
    playOr(unwindUrl, () => {
      for (let i = 0; i < 14; i++) synth.noise({ type: 'bandpass', f0: 2200 - i * 60, q: 6, dur: 0.03, gain: 0.12, delay: i * 0.035 });
    }, { gain: 1 });
    playOr(rewindUrl, () => ultSfx.swell(D.end - D.release, 0.2), { gain: 0.75, endIn: D.end - D.release });
  }, [], D.release);
  // The sand stream is Chronos's time: the center of the frame (following the leading edge of the sand stream) keeps its color, while the surroundings are still stopped grey
  rlook(c, tl, { isolate: 0.7, desat: 0.86, tint: COLD }, { isolate: 1, desat: 0.66, tint: 0xd4d8e0 }, 0.25, D.release);
  tl.to(A, { wind: 0, duration: 0.5, ease: 'power2.out' }, D.release);
  tl.to(A, { hands: 0, duration: 0.6, ease: 'power2.inOut' }, D.release);
  tl.to(A, { lift: 0.8, duration: 0.14, ease: 'power2.out' }, D.release);
  tl.set(A, { jolt: 1 }, D.release + 0.02);
  tl.to(A, { jolt: 0, duration: 0.3, ease: 'power2.out' }, D.release + 0.04);
  if (m.springs) tl.to(m.springs, { k: 0, a: 0, duration: 0.45, ease: 'power2.out' }, D.release);
  tl.call(() => {
    // Path of the time sand: inverted hourglass → onto the opponent
    const from = hgAt();
    const to = sc.center(foe).addScaledVector(g.f, -g.hf * 0.12);
    const tor = makeTorrent(c, g, m.kit!, from, to);
    m.torrent = tor;
    const fov = port ? 1.35 : 1.18;
    // Start: behind and above on the audience side over the shell's back (the reversed key in the foreground), looking at the inverted hourglass and the distant opponent;
    // after the sand stream surges out the camera slides forward with the leading edge while pulling back; at the end it frames Chronos, the sand stream, the opponent and the giant clock in one picture
    const foeC = sc.center(foe);
    const startLook = from.clone().lerp(foeC, 0.28);
    const startPos = cine.orbitPos(side, spiral(), 140, h * 1.4, h * 0.58);
    const pushPos = startPos.clone().lerp(startLook, 0.08);
    const wideLook = g.home.clone().lerp(g.clockC.clone().setY(0), 0.5).setY(Math.max(h * 0.5, g.R * 0.72));
    const wd = fitDist(c, g.R * 2.5, g.dist + g.R * 2.2 + h * 1.4, fov);
    const widePos = wideLook.clone().addScaledVector(g.a, wd * 0.95).addScaledVector(g.f, -wd * 0.28).addScaledVector(UP, h * 0.4);
    const ctrl = tor.path.getPointAt(0.45).addScaledVector(g.a, h * 1.6).addScaledVector(UP, h * 0.35);
    cine.cut(startPos, startLook);
    const a0 = new THREE.Vector3();
    const head = new THREE.Vector3();
    ride(c, (pos, look) => {
      const u = run.u;
      const e = ease.inOutQuad(u);
      a0.lerpVectors(startPos, pushPos, ease.outQuad(run.pre));
      // Quadratic Bezier: start → control point beside the sand stream → wide shot
      pos.set(0, 0, 0).addScaledVector(a0, (1 - e) * (1 - e)).addScaledVector(ctrl, 2 * e * (1 - e)).addScaledVector(widePos, e * e);
      tor.path.getPointAt(clamp01(u), head);
      look.copy(startLook).lerp(head, ss(u, 0, 0.3)).lerp(wideLook, ss(u, 0.45, 1));
    });
    cine.track(() => (run.u > 0 ? tor.path.getPointAt(clamp01(run.u)) : from), ['vig']);
    void cine.look({ fov }, 0);
  }, [], D.release);
  tl.call(() => {
    playOr(breathUrl, () => synth.noise({ type: 'bandpass', f0: 2400, f1: 500, q: 1.2, dur: 0.5, gain: 0.3 }), { gain: 0.85 });
    playOr(sandUrl, () => synth.noise({ type: 'bandpass', f0: 900, f1: 2600, q: 2, dur: 0.6, gain: 0.12, attack: 0.5 }), { gain: 0.8, peakIn: D.arrive - D.launch });
    ultSfx.thump(0.4);
    sc.rig.addTrauma(0.3);
    flares.at(hgAt(), GOLD_HI, h * 0.4, 0.35);
  }, [], D.launch);
  tl.to(run, { pre: 1, duration: D.launch - D.release, ease: 'none' }, D.release);
  tl.to(run, { u: 1, duration: D.arrive - D.launch, ease: 'power1.in' }, D.launch);
  tl.to({ v: 0 }, { v: 1, duration: D.arrive - D.launch, ease: 'power1.in', onUpdate() { if (m.torrent) m.torrent.st.grow = this.targets()[0].v * 0.985; } }, D.launch);
  rlook(c, tl, { fov: port ? 1.35 : 1.18 }, { fov: port ? 1.25 : 1.08 }, D.arrive - D.launch, D.launch, 'power1.in');
  tl.set({}, {}, D.end);
  await playTimeline(tl);
  // Time flows back
  thaw(c);
}

/** Impact: time flows back (color returns, the sand stream floods into the opponent, the giant clock runs backward and shatters) → push in, pull back → the hourglass turns upright and drops back → the time marks rush one by one at the opponent and burst */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe } = c;
  const m = mem(c);
  if (ev.hitIndex < ev.hits || m.hit) return;
  m.hit = true;
  thaw(c);
  const g = m.g ?? geometry(c);
  const lo = low(c);
  const pos = sc.center(foe);
  const home = g.foe.clone();
  const hf = g.hf;
  resumeSound();
  sc.stage.screenFlash(0xfff0d0, lo ? 0.1 : 0.16, 6);
  void cine.pulse({ desat: 0.25, isolate: 0, tint: 0xfff0dc, lift: 0x000000, grain: 0, radial: 0.45 }, { desat: 0, tint: 0xffffff, radial: 0 }, 0.45);
  void cine.look({ bloom: 0.55 }, 0);
  sc.rig.addTrauma(0.55);
  cine.shock(pos, 1.3, 0.8, 1.3);
  cine.track(() => sc.center(foe), ['vig', 'radial']);
  const fx = sc.gs.timeline('fx');
  // The sand stream floods into the opponent, the giant clock runs backward and shatters
  const tor = m.torrent;
  if (tor) {
    fx.to(tor.st, { surge: 1, duration: 0.3, ease: 'power2.in' }, 0);
    fx.to(tor.st, { fade: 1, duration: 0.3, ease: 'power1.in' }, 0.12);
    fx.call(() => tor.kill(), [], 0.5);
  }
  const clk = m.clock;
  if (clk) {
    fx.to(clk.st, { min: clk.st.min - 3, hour: clk.st.hour - 0.5, duration: 0.5, ease: 'power2.out' }, 0);
    fx.to(clk.st, { shatter: 1, duration: 1.1, ease: 'power1.out' }, 0.06);
    fx.call(() => {
      const c0 = g.clockC.clone().addScaledVector(g.clockN, g.R * 0.1);
      sc.vfx.emit({ pos: c0, count: lo ? 20 : 50, color: [GOLD_HI, GOLD, 0xd8e8ff], speed: [3, 8], life: [0.4, 0.9], size: [0.06, 0.14], sizeEnd: 0.2, radius: g.R * 0.6, gravity: 5, drag: 1.2, intensity: 1 });
      void sc.vfx.debris(c0, BRASS, lo ? 6 : 12, 7, 1.3, g.R * 0.05, g.R * 0.7);
    }, [], 0.06);
  }
  // The clock face is burned into the ground, sand bursts from under the opponent's feet
  void sc.vfx.decal(home.clone().setY(0.05), dialTex(), GOLD, hf * 2.2 + 3.2, 2.4, 0, 1.2);
  sc.vfx.emit({ pos: pos, count: lo ? 30 : 70, color: [SAND, GOLD_HI, SAND_LT], speed: [3, 9], life: [0.4, 1], size: [0.05, 0.12], sizeEnd: 0.2, radius: hf * 0.3, gravity: 3, drag: 1.4, intensity: 0.9 });
  sc.vfx.smoke({ pos: home.clone().setY(0.3), count: lo ? 18 : 40, color: [0x8a6a3e, 0xa88650, SAND], speed: [1.5, 4.5], dir: UP, spread: 0.9, life: [0.8, 1.5], size: [0.35, 0.7], sizeEnd: 1.3, radius: hf * 0.5, gravity: -0.8, drag: 1.5 });
  void sc.vfx.ring(home.clone().setY(0.1), GOLD, 0.3, Math.min(hf * 1.6 + 1.5, sc.stage.camera.position.distanceTo(home) * 0.6), 0.5);

  // Camera: first push in a little toward the opponent, then retreat back and up
  void c.wait(0.05).then(() => {
    const r = sc.rig;
    const look = r.look.clone().lerp(pos, 0.35);
    void cine.shot(r.pos.clone().lerp(look, 0.12), look, 0.22, ease.outCubic);
  });
  void c.wait(0.35).then(() => {
    const r = sc.rig;
    const look = r.look.clone().add(new THREE.Vector3(0, hf * 0.2, 0));
    const p = look.clone().add(r.pos.clone().sub(r.look).multiplyScalar(1.2)).add(new THREE.Vector3(0, hf * 0.3, 0));
    void cine.shot(p, look, 0.9, ease.outCubic);
  });

  // The caster: the hourglass turns another half turn (back to how it was) and drops back into the tentacle, the tentacle lowers; the glow of the bezel and clock face slowly fades
  const A = act(c);
  const back = sc.gs.timeline('world');
  back.to(A, { flip: 4, duration: 0.3, ease: 'power2.inOut' }, 0.25);
  back.call(() => playOr(flipUrl, () => synth.tone({ type: 'triangle', f0: 2400, dur: 0.3, gain: 0.04 }), { gain: 0.5, rate: 1.1 }), [], 0.25);
  back.to(A, { toss: 0, duration: 0.35, ease: 'power2.in' }, 0.55);
  back.to(A, { lift: 0, duration: 0.4, ease: 'power2.inOut' }, 0.7);
  back.to(A, { glow: 0.3, bezel: 0.4, dial: 0.3, duration: 0.6, ease: 'power1.inOut' }, 0.4);

  // Fulfilled: the time marks set on the index positions rush one by one at the opponent and burst
  const seals = m.seals;
  if (seals && seals.n > 0) {
    seals.s.forEach((s, i) => {
      const t = 0.4 + i * 0.12;
      fx.to(s, { dive: 1, duration: 0.14, ease: 'none' }, t);
      fx.call(() => {
        const p = sc.center(foe).addScaledVector(UP, (hash(i) - 0.3) * hf * 0.4);
        chime(i + 2, 0.6);
        sc.rig.addTrauma(0.12);
        void sc.vfx.glint(p, GOLD_HI, hf * 0.3 + 0.3, 0.45, 3);
        void sc.vfx.ring(p, GOLD, 0.1, hf * 0.5 + 0.4, 0.4, sc.stage.camera.position.clone().sub(p));
        sc.vfx.emit({ pos: p, count: lo ? 12 : 26, color: [SAND, GOLD_HI, SAND_LT], speed: [1.5, 4], life: [0.4, 0.8], size: [0.05, 0.12], sizeEnd: 0.2, gravity: -3, drag: 1.5, intensity: 0.9 });
        sc.slots[foe].creature?.setFlash(GOLD_HI, 0.55);
      }, [], t + 0.14);
    });
  }
  void c.wait(1.0 + (seals?.n ?? 0) * 0.06).then(() => settle(c, 0.45, 0.4));
}

/** Blocked: the sand stream hits the barrier and scatters into a sand mist; the giant clock's hands run backward and it sinks back underground; the time marks crack and fall */
async function guarded(c: UltCtx): Promise<void> {
  const { sc, foe } = c;
  const m = mem(c);
  thaw(c);
  const g = m.g;
  const hf = g?.hf ?? 1.5;
  const lo = low(c);
  const pos = sc.center(foe);
  synth.tone({ type: 'sawtooth', f0: 900, f1: 180, dur: 0.6, gain: 0.06 });
  for (let i = 0; i < 8; i++) tick(0.1, 1.4 - i * 0.08, 0.05 + i * 0.07);
  void c.cine.look({ desat: 0, isolate: 0, tint: 0xffffff, lift: 0x000000, grain: 0 }, 0.35);
  const fx = sc.gs.timeline('fx');
  const tor = m.torrent;
  if (tor) {
    // The sand stream hits the barrier, its leading edge scatters and the whole stream fades
    fx.to(tor.st, { fade: 1, duration: 0.35, ease: 'power1.in' }, 0);
    sc.vfx.smoke({ pos: pos.clone().addScaledVector(g?.f ?? UP, -hf * 0.4), count: lo ? 20 : 44, color: [SAND, SAND_LT, SAND_DK], speed: [1.5, 4], life: [0.6, 1.1], size: [0.25, 0.5], sizeEnd: 1.4, radius: hf * 0.3, gravity: 1, drag: 1.6 });
  }
  const clk = m.clock;
  if (clk) {
    fx.to(clk.st, { min: clk.st.min - m.turns, hour: clk.st.hour - m.turns / 12, duration: 0.7, ease: 'power2.inOut' }, 0);
    fx.to(clk.st, { face: 0, glow: 0, duration: 0.5 }, 0.2);
    fx.to(clk.st, { sink: 1, duration: 0.7, ease: 'power2.in' }, 0.3);
  }
  m.seals?.s.forEach((s, i) => {
    fx.to(s, { lit: 0, duration: 0.15 }, 0.1 + i * 0.05);
    fx.to(s, { drop: 1, duration: 0.5, ease: 'power2.in' }, 0.15 + i * 0.05);
  });
  const A = act(c);
  const back = sc.gs.timeline('world');
  back.to(A, { retract: 0.7, duration: 0.15, ease: 'power2.out' }, 0);
  back.to(A, { retract: 0, duration: 0.5, ease: 'power2.inOut' }, 0.5);
  back.to(A, { flip: 4, duration: 0.3, ease: 'power2.inOut' }, 0.2);
  back.to(A, { toss: 0, duration: 0.35, ease: 'power2.in' }, 0.5);
  back.to(A, { lift: 0, duration: 0.4, ease: 'power2.inOut' }, 0.65);
  await ultGuarded(c);
}

/** Afterglow: weights go to zero, all VFX are removed */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  thaw(c);
  c.cine.track(null);
  const A = act(c);
  const tl = sc.gs.timeline('world');
  // If interrupted midway with the hourglass still inverted: turn forward to the next upright angle (an even count) and then put it back in the tentacle
  const f0 = A.flip ?? 0;
  const upright = Math.ceil(f0 / 2 - 1e-3) * 2;
  if (Math.abs(f0 - upright) > 1e-3) tl.to(A, { flip: upright, duration: 0.3, ease: 'power2.inOut' }, 0);
  tl.to(A, { toss: 0, duration: 0.35, ease: 'power2.in' }, 0.3);
  tl.to(A, { lift: 0, wind: 0, hands: 0, jolt: 0, retract: 0, duration: 0.4, ease: 'power2.inOut' }, 0.3);
  tl.to(A, { glow: 0, bezel: 0, dial: 0, peer: 0, duration: 0.6, ease: 'power1.inOut' }, 0.2);
  tl.to(A, { focus: 0, duration: 0.5, ease: 'power1.inOut' }, 0.5);
  if (m.studs) tl.to(m.studs.lit, { ...Object.fromEntries(m.studs.lit.map((_, i) => [i, 0])), duration: 0.5 }, 0);
  if (m.clock && m.clock.st.shatter === 0 && m.clock.st.sink === 0) tl.to(m.clock.st, { sink: 1, face: 0, duration: 0.6, ease: 'power2.in' }, 0);
  tl.set({}, {}, 1.0);
  await playTimeline(tl);
  // An even number of turns is the original state; after zeroing, the model goes back to its resting path
  A.flip = 0;
  for (const l of m.layers) l.kill();
  m.layers = [];
  for (const x of [m.studs, m.springs, m.clock, m.seals, m.torrent, m.flares]) x?.kill();
  for (const off of m.offs) off();
  m.offs = [];
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
});
