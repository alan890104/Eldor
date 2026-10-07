// Aeroth, the Sky Sovereign: "Skybreaker"
//
// What this cinematic is about: with one long cry the eagle shoots up into the sea of clouds, its shadow sweeping over the opponent first (the wing-folk say that seeing this shadow is a good omen for a journey,
// while to the opponent it is the ill omen of being marked); it circles above the sea of clouds, folds its wings, and dives all the way down from the zenith, splitting the opponent open together with the sky.
// The higher the altitude (Sky Height 0 to 3), the higher the zenith it circles at and the more sonic booms in the dive (one ring per level).
//
// Model: a hovering, wing-beating eagle (src/render/lab/aerothModel.ts). Action weights used: beat (beating faster and harder),
// cry (mouth open for a long cry), glide (body flat, both wings spread, gliding), tuck (wings folded onto the back); glide + tuck is a head-first dive.
// Positions come only from anchors and the shell: sc.head, sc.eyes, anchor('mouth'), and the model's center of mass (lab.center).
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed)
//   windup (before the announcement, this move's shaders are compiled in the background, waiting at most 1.5 s while the picture keeps moving as usual)
//     0.00  Announcement: letterbox, clouds gather from high up, the sky turns to the cobalt blue of high altitude (its own sky dome, leaving the arena's sky and fog untouched).
//           The camera is at audience side 64°, obliquely from the side, shooting slightly up from below the head, the look-at point following the head (the body sways as it beats its wings), the head kept in the upper part of the frame and the chest left for the name banner,
//           pushing in to 50° within 0.78 s. The eagle beats its wings faster and harder (beat), and the wind all around draws in toward it. Sound: low-frequency wind surging upward, a dull thud.
//     0.16  Eagle cry: mouth open, head thrown back, crest feathers raised, chest pushed out (cry), golden eye glints, two sound-wave rings burst out in front of the mouth, one beat of radial blur. Sound: the eagle's cry (loudest at 0.30).
//     0.72  Beak closes; 0.78 gathering: a sink downward (center of mass drops 0.12 body heights).
//     0.93  Skyward climb: one downstroke blows the dust on the ground into a ring, and the eagle shoots straight up (faster and faster, the body leaning back).
//           The camera retreats to the ground at a low angle on audience side 58°, the look-at point chasing it upward half a beat behind, panning up at most to below the cloud layer;
//           it bursts through the clouds overhead (the clouds split to both sides) and vanishes into the light at the zenith. Sound: the air blast of wingbeats, the wind howl of the climb, a dull thud as it pierces the clouds.
//     1.42  Shadow falls (cut): from high up at the opponent's front diagonal, looking down on a patch of grass. An eagle shadow several times bigger than the eagle sweeps across the ground from the caster's side and passes over the opponent,
//           the opponent darkened by the shadow, the frame dims, grass clippings swept forward by the wind; after the shadow passes, two wind rings tighten and lock on at the opponent's feet.
//           Sound: the whoosh of huge wings sweeping past, an echoing eagle cry in the distance, a heartbeat, a lock-on tone.
//     2.02  Zenith circling (cut): above the sea of clouds. The eagle glides with spread wings (glide), circling in a ring above the opponent, pressing its wing in toward the center of the circle;
//           the camera sweeps around it through about 100°: from looking up from outside and below (deep blue sky) rising to behind and above it, looking down through a gap in the sea of clouds to see the battlefield far below.
//           Sound: wind at high altitude.
//     2.87  End
//   deliver
//     0.00  Roll and tuck: both wings fold onto the back (tuck), the nose presses down; eye glints, the snap of the folding wings. The camera stops behind and above it and turns with it.
//     0.16  Skyfall (cut): diving along a curve that first drops straight down, then cuts diagonally toward the opponent, carrying initial speed from the moment the wings fold and getting faster and faster.
//           The camera falls along on the audience side but cannot catch up: first it hugs its side, then it is left behind and above, watching it grow smaller toward the opponent below;
//           the field of view widens, speed lines and radial blur grow stronger and stronger, head-on wind streaks sweep upward one by one, a white-blue trail drags behind, and clouds are blasted apart as it passes through the cloud layer.
//           There are no clouds on the dive path (for the eagle and the camera). From 0.45 a vapor cone envelops the body; from 0.71 one sonic boom ring per level of altitude (at least one ring, with ever shorter intervals).
//           Sound: the wind howl of the dive (sharpest at the impact), sonic booms.
//     0.80  Cut to the target's view: behind the opponent, audience side, looking up from the ground, the eagle slamming down at the opponent from the gap in the clouds along its trail (caster, direction of attack and opponent in one frame, without crossing the axis).
//     1.00  Slams in (handed to the director to play the impact)
//   impact: one beat of black-and-white inverted impact frame, bloom pressed low; the opponent is struck sky blue; the sky splits open along the dive trail
//           (inside, a void where stars can be seen, with a line of white light at both edges, the same thickness near and far), opens, holds, and heals within 1.5 s;
//           ground cracks, a shockwave ring (not larger than the camera distance), dust swept outward, solid rubble sprayed upward, solid feathers scattering and then drifting down like falling leaves.
//           The camera holds on the hit-stop at the target's view, then at 0.32 s retreats back and up 1.25x; from 1.05 s the post-processing eases back to normal, then after another 0.45 s it pulls back to the wide shot.
//           At 0.12 s the eagle bounces back and up with one big downstroke, glides in an arc high on the caster's side, and lands back in place at 1.5 s (fast start, slow landing).
//           Sound: the boom of the impact with rubble, the ching of a slash, one wingbeat as it pulls up, a long cry on the way back.
//   guarded (this move ignores guard, so in theory it does not happen; a fallback): it hits the barrier and bounces off, and likewise pulls up and flies back to its place.
//   after: weights go to zero, tint restored, clouds and sky dome fade out, the eagle returns to its place facing the opponent; the camera has already been pulled back to the wide shot by settle.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { playOr, preloadSamples } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import boomUrl from '../../../audio/sfx/aeroth-boom.mp3';
import climbUrl from '../../../audio/sfx/aeroth-climb.mp3';
import diveUrl from '../../../audio/sfx/aeroth-dive.mp3';
import gustUrl from '../../../audio/sfx/aeroth-gust.mp3';
import passUrl from '../../../audio/sfx/aeroth-pass.mp3';
import screechUrl from '../../../audio/sfx/aeroth-screech.mp3';
import slamUrl from '../../../audio/sfx/aeroth-slam.mp3';
import windUrl from '../../../audio/sfx/aeroth-wind.mp3';
import { crackTex } from '../../../render/fxtex.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { sceneMaterial, type SpiritMaterial } from '../../../render/spiritToon.ts';
import { glowTex } from '../../../render/textures.ts';
import { LIGHT } from '../../../render/toon.ts';
import { ease } from '../../../render/tween.ts';
import type { FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, eyeGlint } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [screechUrl, gustUrl, climbUrl, passUrl, windUrl, diveUrl, boomUrl, slamUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const CYAN = 0x9fe0ff;
const CYAN_HI = 0xe0f6ff;
const WHITE = 0xffffff;
const GOLD = 0xffc43a;
const BLUE = 0x2e62c0;
const SKY = 0x4a8ce0;
const NAVY = 0x1b3884;
const ROCK = 0x8d846f;
const ROCK_LT = 0xaaa18c;
const UP = new THREE.Vector3(0, 1, 0);
const AX = new THREE.Vector3(1, 0, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};

// Timetable (seconds): each beat of the shot list; the seconds in the file header match these
const T = {
  cry: 0.16,
  cryEnd: 0.72,
  dip: 0.78,
  launch: 0.93,
  climb: 0.49,
  shadow: 1.42,
  orbit: 2.02,
  windup: 2.87,
  flip: 0.16,
  cutHit: 0.8,
  deliver: 1.0,
};

/** Progress curve of the dive: it carries initial speed from the moment the wings fold, then gets faster and faster (u = 0.3t + 0.7t²) */
const diveEase = (t: number): number => 0.3 * t + 0.7 * t * t;
/** The inverse of diveEase: where in the dive time a progress u falls */
const diveTime = (u: number): number => (-0.3 + Math.sqrt(0.09 + 2.8 * u)) / 1.4;

// ───────────────────────── State ─────────────────────────

/** The eagle's flight state: applied to the shell by the flight layer every frame (root's position and heading, pose's pitch and roll about the center of mass) */
interface Flight {
  on: boolean;
  /** World position of the center of mass */
  pos: THREE.Vector3;
  yaw: number;
  /** A positive value is nose down */
  pitch: number;
  /** Roll about the direction of travel */
  roll: number;
}

/** The geometry of this cinematic: all computed from the positions and heights of the two sides and the number of altitude levels */
interface Geo {
  h: number;
  hf: number;
  /** The opponent's size for framing: take the larger of height and body length (for a long opponent like the whale, going by height alone would let the close-up cut it off) */
  fs: number;
  home: THREE.Vector3;
  foe: THREE.Vector3;
  /** The horizontal direction from the caster toward the opponent */
  f: THREE.Vector3;
  /** The horizontal direction of the audience side */
  a: THREE.Vector3;
  /** Height of the center of mass above root (world units) */
  py: number;
  /** Height of the sea of clouds */
  cloudY: number;
  /** Center and radius of the circling ring, and the start and end angles of the glide */
  C: THREE.Vector3;
  R: number;
  th0: number;
  th1: number;
  /** The apex of the skyward climb (center of mass) */
  top: THREE.Vector3;
  /** Dive curve: start (on the circling ring), control point, impact point */
  dive: THREE.QuadraticBezierCurve3;
}

interface Mem {
  alt: number;
  g?: Geo;
  fl: Flight;
  layers: FxLayer[];
  clouds?: Clouds;
  trail?: Trail;
  cone?: { mesh: THREE.Mesh; set(a: number): void };
  /** Dive progress (0 to 1), which the vapor cone reads to decide its heading */
  diveU: number;
  dome?: Dome;
  /** Tween for flying back to its place (after has to wait for it to finish or simply remove it) */
  homing?: gsap.core.Timeline;
}
const mem = (c: UltCtx): Mem => (c.mem.aer ??= { alt: 0, diveU: 0, fl: { on: false, pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0 }, layers: [] }) as Mem;

const creature = (c: UltCtx) => c.sc.slots[c.side].creature;
/** The eagle's action weights (only effective on the experimental model) */
const act = (c: UltCtx): Record<string, number> => creature(c)?.act ?? {};
const low = (c: UltCtx): boolean => c.sc.stage.quality === 'low';

/** Number of "Altitude" levels: the kit:altitude marker in the battle state */
function altitude(c: UltCtx): number {
  const sd = c.view.sides[c.side];
  const m = sd.team[sd.active]?.marks.find((x) => x.id === 'kit:altitude');
  return Math.max(0, Math.min(3, m?.n ?? 0));
}

/** World position of an anchor; use fallback when there is no such anchor */
function anchorPos(c: UltCtx, name: string, fallback: () => THREE.Vector3): THREE.Vector3 {
  const cr = creature(c);
  const a = cr?.anchor(name);
  if (!cr || !a) return fallback();
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}

/** Position of the model's center of mass in pose coordinates (the experimental model's center; the legacy model takes half the body height) */
function pivotLocal(c: UltCtx): THREE.Vector3 {
  const cr = creature(c);
  if (!cr) return new THREE.Vector3(0, 0.75, 0);
  return new THREE.Vector3(0, (cr.lab?.center.y ?? cr.height * 0.5) + cr.body.position.y, 0);
}

function geometry(c: UltCtx): Geo {
  const { sc, side, foe, cine } = c;
  const m = mem(c);
  const cr = creature(c);
  const h = cr?.worldHeight ?? 1.5;
  const fc = sc.slots[foe].creature;
  const hf = fc?.worldHeight ?? 1.5;
  const home = sc.slots[side].home.clone();
  const foeHome = sc.slots[foe].home.clone();
  const f = cine.forward(side);
  const a = cine.orbitPos(side, new THREE.Vector3(), 90, 1, 0).setY(0).normalize();
  const py = pivotLocal(c).y * (cr?.scaler.scale.y ?? 1);
  // The circling ring is directly above the opponent, slightly toward the caster's side; the more altitude levels, the higher it circles
  const alt = m.alt;
  const cloudY = 9.5 + h * 0.6 + alt * 0.6;
  const C = foeHome.clone().addScaledVector(f, -1.5).setY(cloudY + 4.2 + alt * 1.2);
  const R = 3.6 + h * 0.5;
  const th0 = THREE.MathUtils.degToRad(55);
  const th1 = THREE.MathUtils.degToRad(150);
  const circle = (th: number) => C.clone().addScaledVector(f, Math.cos(th) * R).addScaledVector(a, Math.sin(th) * R);
  const S = circle(th1);
  // Impact point: directly in front of the opponent (the caster's side), at half the opponent's body height
  const reach = (fc?.width ?? 1) * 0.45 + h * 0.3;
  const Tp = foeHome.clone().addScaledVector(f, -reach).setY(hf * 0.5 + 0.1);
  // First straight down, with the last stretch cutting diagonally toward the opponent: the control point is directly below the start, with a height that makes the last stretch about 45°
  const horiz = Math.hypot(S.x - Tp.x, S.z - Tp.z);
  const M = new THREE.Vector3(S.x, Tp.y + horiz * 1.05, S.z).lerp(new THREE.Vector3(Tp.x, Tp.y + horiz * 1.05, Tp.z), 0.12);
  return {
    h,
    hf,
    fs: Math.max(hf, (fc?.width ?? 0) * 0.8),
    home,
    foe: foeHome,
    f,
    a,
    py,
    cloudY,
    C,
    R,
    th0,
    th1,
    top: home.clone().setY(cloudY + 3.5),
    dive: new THREE.QuadraticBezierCurve3(S, M, Tp),
  };
}

/**
 * Camera position during the dive: on the audience side, slightly behind, falling along the curve but unable to catch the eagle (lagging a stretch behind it on the curve, falling further behind the later it gets).
 * The sea of clouds is also built using it to clear a path, so the camera does not run headlong into a cloud
 */
function diveCam(g: Geo, u: number, out: THREE.Vector3): THREE.Vector3 {
  const curve = g.dive;
  const S = curve.getPoint(0);
  const uc = Math.max(0, u - 0.34 * Math.pow(u, 1.4));
  curve.getPoint(uc, out);
  const dh = curve.getPoint(1).sub(S).setY(0).normalize();
  const side3 = g.a.clone().multiplyScalar(0.92).addScaledVector(dh, -0.38).normalize();
  const D = THREE.MathUtils.lerp(g.h * 1.9 + 1.4, g.h * 1.5 + 1.2, u);
  out.addScaledVector(side3, D).addScaledVector(UP, D * (0.12 + u * 0.3));
  out.y = Math.max(out.y, 1.2 + g.h * 0.4);
  return out;
}

/** Position at angle th on the circling ring and the direction of travel (the direction in which th increases) */
function circleAt(g: Geo, th: number, out: THREE.Vector3, tan?: THREE.Vector3): THREE.Vector3 {
  out.copy(g.C).addScaledVector(g.f, Math.cos(th) * g.R).addScaledVector(g.a, Math.sin(th) * g.R);
  if (tan) tan.set(0, 0, 0).addScaledVector(g.f, -Math.sin(th)).addScaledVector(g.a, Math.cos(th)).normalize();
  return out;
}

const yawOf = (d: THREE.Vector3): number => Math.atan2(d.x, d.z);

/** Flight layer: when fl.on, applies the flight state to the shell every frame (root's position and heading, pose rotating about the center of mass) */
function flightLayer(c: UltCtx): void {
  const { sc } = c;
  const m = mem(c);
  const cr = creature(c);
  if (!cr) return;
  const qx = new THREE.Quaternion();
  const qz = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const P = new THREE.Vector3();
  const layer = sc.vfx.layer(new THREE.Object3D(), () => {
    const fl = m.fl;
    if (!fl.on) return;
    P.copy(pivotLocal(c));
    const s = cr.scaler.scale.y * cr.root.scale.y;
    cr.root.position.copy(fl.pos).addScaledVector(UP, -P.y * s);
    cr.root.rotation.y = fl.yaw;
    qx.setFromAxisAngle(AX, fl.pitch);
    qz.setFromAxisAngle(AZ, fl.roll);
    q.copy(qz).multiply(qx);
    cr.pose.quaternion.copy(q);
    cr.pose.position.copy(P).sub(P.clone().applyQuaternion(q));
  });
  m.layers.push(layer);
}

/** The flight state starts from how the shell looks now (center of mass at its height at its original place) */
function flightFromRest(c: UltCtx): void {
  const m = mem(c);
  const cr = creature(c);
  const g = m.g!;
  m.fl.pos.copy(cr ? cr.root.position : g.home).add(new THREE.Vector3(0, g.py, 0));
  m.fl.yaw = cr ? cr.root.rotation.y : yawOf(g.f);
  m.fl.pitch = 0;
  m.fl.roll = 0;
}

/** The shell returns to its place: pose zeroed, root back at its stand position, facing the opponent */
function restPose(c: UltCtx): void {
  const cr = creature(c);
  const m = mem(c);
  m.fl.on = false;
  if (!cr) return;
  cr.pose.quaternion.identity();
  cr.pose.position.set(0, 0, 0);
  cr.root.position.copy(c.sc.slots[c.side].home);
  c.sc.faceEachOther();
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

// ───────────────────────── Sky ─────────────────────────

/**
 * Sky at high altitude: a sky dome that follows the camera, drawn in front of the arena's sky and the arena effects' sky backdrop. The zenith is deep cobalt blue, joining down to the fog color on the field
 * so that the distant mountains and fog connect up; a blob of light in the sun's direction (LIGHT.dir). It does not change the arena's sky and fog (the arena effects write them back every frame),
 * so there is no need to restore global state either; just remove this layer.
 */
interface Dome {
  mesh: THREE.Mesh;
  fade: { k: number };
  kill(): void;
}
function skyDome(c: UltCtx): Dome {
  const { sc } = c;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: 0 },
      uTop: { value: new THREE.Color(0x163c9c) },
      uMid: { value: new THREE.Color(0x3f86dc) },
      uFog: { value: new THREE.Color() },
      uSun: LIGHT.dir,
    },
    vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uA; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uFog; uniform vec3 uSun; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        float h = d.y;
        vec3 c = mix(uFog, uMid, smoothstep(-0.04, 0.2, h));
        c = mix(c, uTop, smoothstep(0.2, 0.9, h));
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += vec3(1.0, 0.95, 0.82) * (pow(s, 90.0) * 0.8 + pow(s, 8.0) * 0.12);
        gl_FragColor = vec4(c, uA);
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), mat);
  m.renderOrder = -0.5;
  m.frustumCulled = false;
  const fade = { k: 0 };
  const cam = sc.stage.camera;
  const layer = sc.vfx.layer(m, () => {
    m.position.copy(cam.position);
    (mat.uniforms.uFog.value as THREE.Color).copy(sc.arena.fog.color);
    mat.uniforms.uA.value = fade.k;
    m.visible = fade.k > 0.002;
  });
  return { mesh: m, fade, kill: () => layer.kill() };
}

// ───────────────────────── Solid clouds, rubble, feathers ─────────────────────────

/** The scene's cartoon material, going through the post-processing outline for scene objects (thinner than the spirits', so the spirits' outlines remain the heaviest) */
function solid(geo: THREE.BufferGeometry, mat: SpiritMaterial): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.layers.enable(INK_LAYER);
  m.userData.inkScene = true;
  return m;
}

/** A cartoon cloud: several flattened spheres stuck together into a clump, with the bottom cut flat; seed decides the shape */
function cloudGeo(seed: number, lo: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 5 + Math.floor(hash(seed) * 3);
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1;
    const r = 0.55 + 0.45 * Math.cos(u * 1.3) + hash(seed + i * 7) * 0.2;
    const g = new THREE.SphereGeometry(r, lo ? 12 : 18, lo ? 8 : 12);
    g.scale(1, 0.78, 0.9);
    g.translate(u * 1.35 + (hash(seed + i) - 0.5) * 0.3, r * 0.25 + hash(seed + i * 3) * 0.15, (hash(seed + i * 5) - 0.5) * 0.7);
    parts.push(g);
  }
  const geo = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  // Bottom cut flat: the underside of the cloud is a flat line
  const pa = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) {
    const y = pa.getY(i);
    if (y < 0) pa.setY(i, y * 0.18);
  }
  geo.computeVertexNormals();
  return geo;
}

interface Clouds {
  root: THREE.Group;
  mat: SpiritMaterial;
  /** The layer overhead (splits to both sides when the eagle bursts through): each cloud's original place and outward direction */
  gate: { m: THREE.Mesh; at: THREE.Vector3; out: THREE.Vector3 }[];
  /** 0 = closed, 1 = fully split */
  split: { k: number };
  /** Opacity of the whole set */
  fade: { k: number };
  kill(): void;
}

/**
 * Sea of clouds: a ring of cartoon clouds around the sky above the battlefield (with a hole in the middle, so the battlefield can be seen from high up), plus a small layer of cloud above the caster's head that gets burst through.
 * All are solid cartoon clouds, taking the same shading and outline; fading in and out uses the spirit material's uOpacity (the outline fades along).
 */
function makeClouds(c: UltCtx, g: Geo): Clouds {
  const { sc } = c;
  const lo = low(c);
  const root = new THREE.Group();
  const mat = sceneMaterial(0xf4f8ff, { rim: 0.3 });
  // Transparent all the time: fading in/out and full brightness use the same shader, so there is no recompile midway through the cinematic from switching
  mat.transparent = true;
  const mid = g.home.clone().lerp(g.foe, 0.5).setY(0);
  const n = lo ? 12 : 22;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + hash(i * 3.1) * 0.35;
    const rad = 10 + hash(i * 1.7) * 18 + (i % 3) * 4;
    const m = solid(cloudGeo(i * 13 + 1, lo), mat);
    const size = 1.8 + hash(i * 2.3) * 1.8 + rad * 0.04;
    m.scale.setScalar(size);
    m.position.set(mid.x + Math.cos(ang) * rad, g.cloudY + (hash(i * 4.9) - 0.5) * 1.6, mid.z + Math.sin(ang) * rad);
    m.rotation.y = hash(i * 8.3) * Math.PI * 2;
    root.add(m);
  }
  // A few higher, smaller clouds outside the circling ring: they sweep past the side as the camera circles, showing speed and height
  for (let i = 0; i < (lo ? 3 : 6); i++) {
    const th = g.th0 + (i / 5) * (g.th1 - g.th0) + 0.2;
    const p = new THREE.Vector3();
    circleAt(g, th, p);
    const out = p.clone().sub(g.C).setY(0).normalize();
    const m = solid(cloudGeo(200 + i * 7, lo), mat);
    m.scale.setScalar(1.1 + hash(i * 5.5) * 0.7);
    m.position.copy(p).addScaledVector(out, g.R * (1.6 + hash(i) * 0.8)).setY(g.C.y - 1.5 - hash(i * 2) * 2.5);
    m.rotation.y = hash(i * 9.1) * Math.PI * 2;
    root.add(m);
  }
  // There must be no clouds on the dive path (the eagle and the follow camera): any that block it are pushed horizontally outward
  const lane: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = (i / 24) * 0.8;
    lane.push(g.dive.getPoint(u), diveCam(g, u, new THREE.Vector3()));
  }
  const clear = (p: THREE.Vector3, s: number) => {
    for (let pass = 0; pass < 3; pass++) {
      for (const q of lane) {
        if (Math.abs(q.y - p.y) > s * 1.2 + 1.2) continue;
        const dx = p.x - q.x;
        const dz = p.z - q.z;
        const d = Math.hypot(dx, dz);
        const need = s * 2.7 + 1.6;
        if (d >= need) continue;
        const k = d > 1e-3 ? (need - d) / d : 0;
        if (k) p.set(p.x + dx * k, p.y, p.z + dz * k);
        else p.addScaledVector(g.a, need);
      }
    }
  };
  for (const m of root.children as THREE.Mesh[]) clear(m.position, m.scale.x);
  // The cloud layer overhead: three clouds directly above the caster, splitting to both sides when the eagle shoots up
  const gate: Clouds['gate'] = [];
  const side = g.a.clone();
  for (let i = 0; i < 3; i++) {
    const u = i - 1;
    const m = solid(cloudGeo(400 + i * 11, lo), mat);
    m.scale.setScalar(1.6 + (1 - Math.abs(u)) * 0.5);
    const at = g.home.clone().addScaledVector(side, u * 2.1).addScaledVector(g.f, (hash(i * 3) - 0.5) * 1.2).setY(g.cloudY - 0.8 + hash(i) * 0.5);
    m.position.copy(at);
    m.rotation.y = yawOf(g.f) + Math.PI / 2 + (hash(i * 7) - 0.5) * 0.4;
    root.add(m);
    const out = side.clone().multiplyScalar(u === 0 ? (hash(i * 5) < 0.5 ? -1 : 1) : Math.sign(u)).addScaledVector(g.f, (hash(i * 9) - 0.5) * 0.6);
    // The positions they stop at after splitting also have to stay clear of the dive path
    const end = at.clone().addScaledVector(out, 3.2);
    clear(end, m.scale.x * 0.65);
    gate.push({ m, at, out: end.sub(at).divideScalar(3.2) });
  }
  const split = { k: 0 };
  const fade = { k: 0 };
  const layer = sc.vfx.layer(root, () => {
    const k = ease.outCubic(Math.min(1, split.k));
    for (const s of gate) {
      s.m.position.copy(s.at).addScaledVector(s.out, k * 3.2).add(new THREE.Vector3(0, k * 0.4, 0));
      s.m.scale.setScalar((1.6 + (s === gate[1] ? 0.5 : 0)) * (1 - k * 0.35));
    }
    mat.uniforms.uOpacity.value = fade.k;
    root.visible = fade.k > 0.002;
  });
  registerInkRoot(root);
  return { root, mat, gate, split, fade, kill: () => layer.kill() };
}

/** Rubble: a ring of solid stones sprayed upward from the impact point, bouncing once on landing and then sinking into the ground */
function rocks(c: UltCtx, at: THREE.Vector3, r: number): void {
  const { sc } = c;
  const lo = low(c);
  const n = lo ? 7 : 14;
  const root = new THREE.Group();
  const mats = [sceneMaterial(ROCK, { rim: 0.25 }), sceneMaterial(ROCK_LT, { rim: 0.25 })];
  const bits: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; s: number; bounced: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const s = r * (0.12 + hash(i * 3.7) * 0.16);
    const m = solid(new THREE.IcosahedronGeometry(1, 0), mats[i % 2]);
    m.scale.set(s, s * (0.7 + hash(i) * 0.4), s * (0.8 + hash(i * 2) * 0.3));
    const ang = (i / n) * Math.PI * 2 + hash(i * 5.3) * 0.5;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    m.position.copy(at).addScaledVector(dir, r * 0.35).setY(0.1);
    const v = dir.multiplyScalar(2 + hash(i * 7.1) * 3.5).add(new THREE.Vector3(0, 5 + hash(i * 1.3) * 5, 0));
    const w = new THREE.Vector3(hash(i * 2.2) - 0.5, hash(i * 4.4) - 0.5, hash(i * 6.6) - 0.5).multiplyScalar(14);
    root.add(m);
    bits.push({ m, v, w, s, bounced: false });
  }
  registerInkRoot(root);
  const DUR = 1.9;
  let t = 0;
  void sc.vfx.spawn(root, DUR, (_k, dt) => {
    t += dt;
    for (const b of bits) {
      if (t < DUR - 0.45) {
        b.v.y -= 18 * dt;
        b.m.position.addScaledVector(b.v, dt);
        const floor = b.s * 0.55;
        if (b.m.position.y < floor) {
          b.m.position.y = floor;
          if (!b.bounced && b.v.y < -2) {
            b.bounced = true;
            b.v.y = -b.v.y * 0.3;
            b.v.x *= 0.5;
            b.v.z *= 0.5;
            b.w.multiplyScalar(0.4);
          } else {
            b.v.set(0, 0, 0);
            b.w.set(0, 0, 0);
          }
        }
        b.m.rotation.x += b.w.x * dt;
        b.m.rotation.y += b.w.y * dt;
        b.m.rotation.z += b.w.z * dt;
      } else b.m.position.y -= dt * b.s * 3;
    }
  });
}

/** One solid feather: a flat feather vane plus a golden shaft */
function featherMesh(len: number, col: number, gold: SpiritMaterial): THREE.Group {
  const sh = new THREE.Shape();
  const w = len * 0.22;
  sh.moveTo(0, 0);
  sh.bezierCurveTo(w, len * 0.2, w * 1.05, len * 0.7, 0, len);
  sh.bezierCurveTo(-w * 0.9, len * 0.72, -w * 0.8, len * 0.25, 0, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: len * 0.02, bevelEnabled: true, bevelThickness: len * 0.012, bevelSize: len * 0.012, bevelSegments: 1, curveSegments: 10 });
  geo.translate(0, -len * 0.5, -len * 0.01);
  const g = new THREE.Group();
  g.add(solid(geo, sceneMaterial(col, { rim: 0.4 })));
  const shaft = solid(new THREE.CylinderGeometry(len * 0.012, len * 0.02, len * 1.08, 6), gold);
  shaft.position.set(0, -len * 0.02, len * 0.02);
  g.add(shaft);
  return g;
}

/**
 * Feathers: bursting outward in all directions from at, slowing under drag, then drifting down like falling leaves swaying side to side (tumbling about the shaft as they go); fading out over the last 0.5 s.
 * Solid cartoon feathers, going through the scene's outline.
 */
function feathers(c: UltCtx, at: THREE.Vector3, n: number, size: number, dur: number): void {
  const { sc } = c;
  const root = new THREE.Group();
  const gold = sceneMaterial(GOLD, { rim: 0.4 });
  const cols = [BLUE, SKY, 0xf6f8fc, NAVY, BLUE];
  const list: { g: THREE.Group; v: THREE.Vector3; ph: number; sw: number; spin: number; mats: SpiritMaterial[] }[] = [];
  for (let i = 0; i < n; i++) {
    const g = featherMesh(size * (0.8 + hash(i * 1.9) * 0.5), cols[i % cols.length], gold);
    g.position.copy(at);
    const dir = new THREE.Vector3(hash(i * 3.3) - 0.5, 0.3 + hash(i * 5.7) * 0.7, hash(i * 7.9) - 0.5).normalize();
    g.rotation.set(hash(i) * 6.3, hash(i * 2) * 6.3, hash(i * 4) * 6.3);
    root.add(g);
    const mats: SpiritMaterial[] = [];
    g.traverse((o) => {
      const mm = (o as THREE.Mesh).material as SpiritMaterial | undefined;
      if (mm?.isSpiritMaterial && !mats.includes(mm)) mats.push(mm);
    });
    list.push({ g, v: dir.multiplyScalar(4 + hash(i * 9.1) * 5), ph: hash(i * 6.1) * 6.3, sw: 1.8 + hash(i * 8.2) * 1.4, spin: (hash(i * 3.9) - 0.5) * 5, mats });
  }
  registerInkRoot(root);
  let t = 0;
  void sc.vfx.spawn(root, dur, (k, dt) => {
    t += dt;
    const fadeK = Math.min(1, Math.max(0, (dur - t) / 0.5));
    for (const f of list) {
      // First carried out by the blast wave, with heavy drag; afterwards their falling speed converges to very slow, swaying side to side
      f.v.multiplyScalar(Math.exp(-3.2 * dt));
      f.v.y -= 1.2 * dt;
      f.v.y = Math.max(f.v.y, -0.9);
      const sway = Math.sin(t * f.sw + f.ph);
      f.g.position.addScaledVector(f.v, dt);
      f.g.position.x += sway * 0.6 * dt;
      f.g.position.z += Math.cos(t * f.sw * 0.8 + f.ph) * 0.4 * dt;
      if (f.g.position.y < 0.05) f.g.position.y = 0.05;
      f.g.rotation.z = sway * 0.9;
      f.g.rotation.y += f.spin * dt;
      f.g.rotation.x = 1.2 + Math.cos(t * f.sw + f.ph) * 0.35;
      for (const mm of f.mats) {
        mm.uniforms.uOpacity.value = fadeK;
        mm.transparent = fadeK < 0.999;
      }
    }
    void k;
  });
}

// ───────────────────────── VFX ─────────────────────────

/** A ring of additive light with its own brightness control (vfx.ring is too bright and washes out when close to the camera); without normal it is horizontal */
function ringFx(c: UltCtx, pos: THREE.Vector3, col: THREE.ColorRepresentation, r0: number, r1: number, dur: number, intensity = 0.9, width = 0.12, normal?: THREE.Vector3): Promise<void> {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(intensity), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 64), mat);
  m.position.copy(pos);
  if (normal) m.quaternion.setFromUnitVectors(AZ, normal.clone().normalize());
  else m.rotation.x = -Math.PI / 2;
  return c.sc.vfx.spawn(m, dur, (k) => {
    const r = r0 + (r1 - r0) * (1 - Math.pow(1 - k, 3));
    m.scale.setScalar(Math.max(1e-3, r));
    mat.opacity = 1 - k * k;
  });
}

/** Eagle shadow: a huge shadow of a wing-spread eagle on the ground (a top-down silhouette), with soft edges */
let shadowTexCache: THREE.Texture | null = null;
function eagleShadowTex(): THREE.Texture {
  if (shadowTexCache) return shadowTexCache;
  const s = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  g.translate(s / 2, s / 2);
  g.filter = 'blur(7px)';
  g.fillStyle = '#fff';
  // Body, head, spread tail fan (the head points toward -y, which is the top of the texture)
  g.beginPath();
  g.ellipse(0, 10, 26, 70, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(0, -70, 20, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-14, 60);
  g.lineTo(-44, 150);
  g.quadraticCurveTo(0, 170, 44, 150);
  g.lineTo(14, 60);
  g.fill();
  // Wings: the leading edge sweeps slightly outward and forward, the trailing edge is the serrations of individual flight feathers, and the wingtips split apart into fingers
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 18, -20);
    g.quadraticCurveTo(sx * 120, -46, sx * 236, -18);
    for (let i = 0; i < 5; i++) {
      const x = sx * (236 - i * 16);
      g.lineTo(x + sx * 6, -4 + i * 8);
      g.lineTo(x - sx * 8, 2 + i * 8);
    }
    for (let i = 0; i < 8; i++) {
      const x = sx * (160 - i * 18);
      g.quadraticCurveTo(x, 70 - i * 2, x - sx * 18, 52 - i * 2);
    }
    g.lineTo(sx * 18, 36);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  shadowTexCache = t;
  return t;
}

/**
 * Eagle shadow sweeping past: slides from from along dir over a distance of len, darkening the opponent as it passes over. The progress k is driven by the caller with the world clock
 * (the effects layer's clock does not follow battle speed, so at faster speeds the shadow is not cut away before it has passed)
 */
function shadowPass(c: UltCtx, from: THREE.Vector3, dir: THREE.Vector3, len: number, span: number): { k: number; kill(): void } {
  const { sc, foe } = c;
  const mat = new THREE.MeshBasicMaterial({ map: eagleShadowTex(), color: 0x0c1230, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(span, span), mat);
  m.renderOrder = 2;
  m.rotation.set(-Math.PI / 2, 0, 0);
  // The texture's head points up (-y) = the plane's +y; after laying it flat +y points to -z, then it is rotated to dir
  m.rotation.z = Math.atan2(dir.x, -dir.z) + Math.PI;
  const fc = sc.slots[foe].creature;
  const foePos = sc.slots[foe].home;
  const st = { k: 0, kill: () => layer.kill() };
  const layer = sc.vfx.layer(m, () => {
    const k = st.k;
    m.position.copy(from).addScaledVector(dir, len * k).setY(0.05);
    mat.opacity = 0.72 * Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.12);
    const d = Math.abs(m.position.clone().sub(foePos).dot(dir));
    const over = Math.max(0, 1 - d / (span * 0.35));
    if (fc && over > 0) fc.setFlash(0x10183a, 0.6 * over);
  });
  mem(c).layers.push(layer);
  return st;
}

/** Trail: a white-blue band of light along the dive curve, its head following the eagle; it flares once on impact and then fades */
interface Trail {
  root: THREE.Object3D;
  set(head: number): void;
  flare(): void;
  kill(): void;
}
function makeTrail(c: UltCtx, curve: THREE.Curve<THREE.Vector3>, radius: number): Trail {
  const { sc } = c;
  const mk = (r: number, col: number, hi: number, inten: number, gain: number) => new THREE.Mesh(new THREE.TubeGeometry(curve, 96, r, 10, false), new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(col).multiplyScalar(inten) }, uHi: { value: new THREE.Color(hi).multiplyScalar(inten) }, uHead: { value: 0 }, uA: { value: 1 }, uGain: { value: gain }, uT: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uHi; uniform float uHead; uniform float uA; uniform float uGain; uniform float uT;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float x = vUv.x;
        if (x > uHead) discard;
        float f = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(f, 3.0);
        // Brighter and thicker toward the head; the tail fades; streaks follow the flow direction
        float nearHead = smoothstep(uHead - 0.55, uHead, x);
        float streak = 0.75 + 0.25 * sin(x * 160.0 - uT * 50.0 + vUv.y * 6.2831853 * 2.0);
        float a = (core * 0.9 + pow(f, 1.3) * 0.35) * (0.35 + 0.65 * nearHead) * streak * smoothstep(0.0, 0.05, x) * uGain * uA;
        gl_FragColor = vec4(mix(uCol, uHi, core) * a, min(1.0, a));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const core = mk(radius, CYAN, WHITE, 1.1, 1);
  const halo = mk(radius * 3.2, 0x5aa8f0, CYAN, 0.7, 0.35);
  const g = new THREE.Group();
  g.add(halo, core);
  let head = 0;
  let flare = 0;
  let fading = false;
  let a = 1;
  const layer = sc.vfx.layer(g, (dt, t) => {
    g.visible = head > 0.001;
    if (fading) a = Math.max(0, a - dt / 0.9);
    flare = Math.max(0, flare - dt * 2.5);
    for (const mm of [core, halo]) {
      const u = (mm.material as THREE.ShaderMaterial).uniforms;
      u.uHead.value = head;
      u.uT.value = t;
      u.uA.value = a * (1 + flare * 1.2);
    }
    if (fading && a <= 0) layer.kill();
  });
  mem(c).layers.push(layer);
  return {
    root: g,
    set: (h) => (head = h),
    flare: () => {
      flare = 1;
      fading = true;
    },
    kill: () => layer.kill(),
  };
}

/** Vapor cone: a white cone enveloping the eagle when it breaks the sound barrier, the tip ahead of the head and opening backward, turning with the direction of flight */
function vaporCone(c: UltCtx, h: number, dirOf: () => THREE.Vector3): { mesh: THREE.Mesh; set(a: number): void } {
  const { sc } = c;
  const m = mem(c);
  const L = h * 1.5;
  const R = h * 0.62;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uT; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 1.8);
        float flow = 0.6 + 0.4 * sin(vUv.x * 40.0 + vUv.y * 26.0 - uT * 60.0);
        float tail = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        float a = (rim * 1.1 * flow + 0.06) * tail * uA;
        gl_FragColor = vec4(mix(vec3(0.6, 0.8, 1.0), vec3(0.95, 0.98, 1.0), rim) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  // The cone's tip is at +y: put the tip ahead of the head, opening backward (-y)
  const geo = new THREE.ConeGeometry(R, L, 28, 1, true);
  geo.translate(0, -L * 0.5 + h * 0.4, 0);
  const cone = new THREE.Mesh(geo, mat);
  let alpha = 0;
  const layer = sc.vfx.layer(cone, (_dt, t) => {
    cone.position.copy(m.fl.pos);
    cone.quaternion.setFromUnitVectors(UP, dirOf());
    mat.uniforms.uT.value = t;
    mat.uniforms.uA.value = alpha;
    cone.visible = alpha > 0.01;
    const w = 1 + Math.sin(t * 47) * 0.04;
    cone.scale.set(w, 1, w);
  });
  m.layers.push(layer);
  return { mesh: cone, set: (a) => (alpha = a) };
}

/** The Rift's two-layer material: a dark void in the middle (normal blending, stars visible), and a line of white light at both edges (additive) */
function splitMats(): { voidMat: THREE.ShaderMaterial; edgeMat: THREE.ShaderMaterial } {
  const voidMat = new THREE.ShaderMaterial({
    uniforms: { uOpen: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uOpen; varying vec2 vUv;
      void main(){
        float y = abs(vUv.y * 2.0 - 1.0);
        float gap = uOpen * (0.25 + 0.75 * sin(3.14159 * clamp(vUv.x, 0.0, 1.0)));
        if (y > gap) discard;
        float e = y / max(gap, 1e-3);
        vec3 col = mix(vec3(0.01, 0.015, 0.06), vec3(0.08, 0.1, 0.3), smoothstep(0.0, 1.0, e));
        // Stars beyond the sky show through the rift: scattered bright dots in a screen-space grid
        vec2 cell = floor(gl_FragCoord.xy / 3.0);
        float r = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        col += vec3(0.75, 0.88, 1.0) * step(0.982, r) * (1.0 - e);
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthWrite: false,
    toneMapped: false,
  });
  const edgeMat = new THREE.ShaderMaterial({
    uniforms: { uOpen: { value: 0 }, uA: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uOpen; uniform float uA; varying vec2 vUv;
      void main(){
        float y = abs(vUv.y * 2.0 - 1.0);
        float gap = uOpen * (0.25 + 0.75 * sin(3.14159 * clamp(vUv.x, 0.0, 1.0)));
        float d = y - gap;
        float core = exp(-abs(d) * 90.0);
        float glow = d > 0.0 ? exp(-d * 14.0) * 0.35 : 0.0;
        float a = (core + glow) * uA * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        gl_FragColor = vec4(mix(vec3(0.62, 0.86, 1.0), vec3(1.0), core) * a * 1.2, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  return { voidMat, edgeMat };
}

/** Rift: the sky splits open along the dive trail. A long strip facing the camera, with a dark void in the middle and a line of white light at both edges; it opens, holds, and then slowly heals */
function skySplit(c: UltCtx, curve: THREE.Curve<THREE.Vector3>, width: number, dur: number): void {
  const { sc } = c;
  const N = 48;
  const U1 = 0.9;
  const build = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3));
    const uv: number[] = [];
    for (let i = 0; i <= N; i++) uv.push(i / N, 0, i / N, 1);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const idx: number[] = [];
    for (let i = 0; i < N; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    return g;
  };
  const { voidMat, edgeMat } = splitMats();
  const gv = build();
  const ge = build();
  const vm = new THREE.Mesh(gv, voidMat);
  const em = new THREE.Mesh(ge, edgeMat);
  vm.renderOrder = 30;
  em.renderOrder = 31;
  vm.frustumCulled = false;
  em.frustumCulled = false;
  const root = new THREE.Group();
  root.add(vm, em);
  const cam = sc.stage.camera;
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const sd = new THREE.Vector3();
  void sc.vfx.spawn(root, dur, (k) => {
    // Snaps open, holds for a beat, then slowly heals
    const open = k < 0.06 ? ease.outExpo(k / 0.06) : k < 0.35 ? 1 : 1 - ease.inOutQuad((k - 0.35) / 0.65);
    const halfW = width * 1.8;
    for (const [geo, w] of [[gv, halfW], [ge, halfW]] as [THREE.BufferGeometry, number][]) {
      const pa = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * U1;
        curve.getPointAt(u, p);
        curve.getTangentAt(u, tan);
        toCam.copy(cam.position).sub(p);
        // Far away it widens with distance, so the whole crack looks equally thick on screen
        const dist = toCam.length();
        toCam.divideScalar(Math.max(dist, 1e-4));
        sd.crossVectors(tan, toCam).normalize().multiplyScalar(w * Math.max(1, dist / 5));
        pa.setXYZ(i * 2, p.x - sd.x, p.y - sd.y, p.z - sd.z);
        pa.setXYZ(i * 2 + 1, p.x + sd.x, p.y + sd.y, p.z + sd.z);
      }
      pa.needsUpdate = true;
    }
    voidMat.uniforms.uOpen.value = open * 0.6;
    edgeMat.uniforms.uOpen.value = open * 0.6;
    edgeMat.uniforms.uA.value = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  });
}

/** Impact crater: a patch of dark cracks on the ground (normal blending, so that it can be pressed dark) */
const craterMat = () => new THREE.MeshBasicMaterial({ map: crackTex(3), color: 0x2a2436, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
function crater(c: UltCtx, at: THREE.Vector3, size: number, dur: number): void {
  const mat = craterMat();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.set(-Math.PI / 2, 0, hash(at.x) * 6.3);
  m.position.copy(at).setY(0.045);
  m.renderOrder = 2;
  void c.sc.vfx.spawn(m, dur, (k) => {
    mat.opacity = 0.85 * (k < 0.05 ? k / 0.05 : Math.pow(1 - (k - 0.05) / 0.95, 1.2));
    m.scale.setScalar(0.85 + 0.15 * Math.min(1, k * 8));
  });
}

/** Light at the zenith: the ball of light the eagle flies into on the skyward climb (VFX, takes bloom) */
function zenithGlare(c: UltCtx, at: THREE.Vector3, size: number, dur: number): void {
  const mat = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xfff4d8).multiplyScalar(1.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const s = new THREE.Sprite(mat);
  s.position.copy(at);
  void c.sc.vfx.spawn(s, dur, (k) => {
    mat.opacity = Math.min(1, k / 0.25) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1) * 0.9;
    s.scale.setScalar(size * (0.8 + 0.3 * k));
  });
}

// ───────────────────────── Sound ─────────────────────────
// The eagle cry, wingbeats, skyward climb, shadow sweep, high-altitude wind, dive, sonic boom and impact are audio files generated by ElevenLabs; synthesized versions are used until they finish loading

function screech(gain = 1, peakIn?: number, rate = 1): void {
  playOr(screechUrl, () => {
    synth.tone({ type: 'sawtooth', f0: 2600 * rate, f1: 1500 * rate, dur: 0.55, gain: 0.06 * gain, attack: 0.03 });
    synth.tone({ type: 'sine', f0: 2650 * rate, f1: 1520 * rate, dur: 0.55, gain: 0.13 * gain, attack: 0.03, detune: 9 });
    synth.noise({ type: 'bandpass', f0: 3000, f1: 1800, q: 6, dur: 0.5, gain: 0.16 * gain, attack: 0.03 });
  }, { gain: 0.75 * gain, peakIn, rate });
}

/** Sonic boom: a dry crack (synthesized, since the audio file's highs are not crisp enough) plus a low-frequency boom */
function boom(gain = 1): void {
  synth.noise({ type: 'highpass', f0: 3500, f1: 200, dur: 0.35, gain: 0.5 * gain });
  playOr(boomUrl, () => {
    synth.noise({ type: 'lowpass', f0: 2000, f1: 80, dur: 0.6, gain: 0.5 * gain });
    synth.tone({ type: 'sine', f0: 90, f1: 28, dur: 0.7, gain: 0.6 * gain });
  }, { gain: 0.65 * gain });
}

function gust(gain = 1): void {
  playOr(gustUrl, () => {
    synth.noise({ type: 'lowpass', f0: 900, f1: 160, dur: 0.45, gain: 0.45 * gain });
    synth.tone({ type: 'sine', f0: 80, f1: 40, dur: 0.4, gain: 0.3 * gain });
  }, { gain: 0.8 * gain });
}

// ───────────────────────── Cinematic ─────────────────────────

/**
 * Compile shaders first: the materials newly used by this move (clouds, sky dome, trail, vapor cone, Rift, cracks, feathers and rubble) are compiled in the background before the announcement
 * (KHR_parallel_shader_compile, without stalling the picture), so the first frame after the announcement and the moment of impact do not hitch.
 * Objects not yet shown (the clouds and sky dome before fading in) are compiled too; in addition a few sample materials not attached to the scene cover the VFX that are only built at impact.
 * The main picture is drawn into a half-precision render target (the outline pipeline), and compiling targets the same kind of target so that the shader versions match. It waits at most cap seconds.
 */
async function precompile(c: UltCtx, roots: THREE.Object3D[], cap: number): Promise<void> {
  const { sc } = c;
  const st = sc.stage;
  const r = st.renderer;
  const pre = new THREE.Group();
  const dummy = new THREE.PlaneGeometry(1, 1);
  const { voidMat, edgeMat } = splitMats();
  const opaque = sceneMaterial(GOLD, { rim: 0.4 });
  const faded = sceneMaterial(BLUE, { rim: 0.4 });
  faded.transparent = true;
  const ring = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  for (const mat of [voidMat, edgeMat, craterMat(), opaque, faded, ring]) pre.add(new THREE.Mesh(dummy, mat));
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const prev = r.getRenderTarget();
  r.setRenderTarget(rt);
  let jobs: Promise<unknown>[] = [];
  try {
    jobs = [...roots, pre].map((o) => r.compileAsync(o, st.camera, st.scene));
  } finally {
    r.setRenderTarget(prev);
  }
  await Promise.race([Promise.all(jobs), sc.tw.wait(cap, 'real')]);
  rt.dispose();
  dummy.dispose();
}

/** Announcement → eagle cry → skyward climb → shadow falls → zenith circling */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  m.alt = altitude(c);
  const g = geometry(c);
  m.g = g;
  const h = g.h;
  const A = act(c);
  const lo = low(c);
  const port = sc.portrait;
  flightLayer(c);
  flightFromRest(c);
  // Build the sea of clouds, sky dome, trail and vapor cone first (none visible yet), and compile the shaders before the announcement
  const clouds = makeClouds(c, g);
  m.clouds = clouds;
  m.layers.push({ kill: () => clouds.kill(), get alive() { return true; } });
  const dome = skyDome(c);
  m.dome = dome;
  m.layers.push({ kill: () => dome.kill(), get alive() { return true; } });
  const trail = makeTrail(c, g.dive, 0.05 + h * 0.035);
  m.trail = trail;
  const cone = vaporCone(c, h, () => g.dive.getTangent(Math.min(0.999, Math.max(0.001, m.diveU))));
  m.cone = cone;
  await precompile(c, [clouds.root, dome.mesh, trail.root, cone.mesh], 1.5);
  const head0 = sc.head(side);

  const tl = sc.gs.timeline('world');
  const push = { k: 0 };
  // ① Announcement: the sky deepens and the clouds gather; the camera pressed below the head, shooting up
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    synth.dropMusic();
    synth.noise({ type: 'bandpass', f0: 240, f1: 900, q: 0.9, dur: 0.9, gain: 0.3, attack: 0.6 });
    synth.tone({ type: 'sine', f0: 46, f1: 38, dur: 1.0, gain: 0.3, attack: 0.2 });
    ultSfx.thump(0.35);
    void cine.look({ letterbox: 1, vignette: 0.6, desat: 0, tint: 0xdfe8f8, lift: 0x000000, bloom: 0.55, fov: port ? 1.3 : 1 }, 0.35, ease.outQuad);
    cine.track(() => sc.head(side), ['vig', 'radial']);
    // Close-up: the look-at point follows the head (the body bobs up and down as it beats its wings), the head kept in the upper three-tenths of the frame and the chest left for the name banner
    // Oblique side view: the open beak and crest feathers read best from the side, and the eyes are still in the frame
    const camA = cine.orbitPos(side, head0, 64, h * 1.45, -h * 0.24);
    const camB = cine.orbitPos(side, head0, 50, h * 1.2, -h * 0.22);
    const hs = head0.clone();
    cine.cut(camA, hs.clone().addScaledVector(UP, -h * 0.03));
    ride(c, (pos, look, dt) => {
      pos.lerpVectors(camA, camB, ease.outQuad(push.k));
      hs.lerp(sc.head(side), 1 - Math.exp(-dt * 12));
      look.copy(hs).addScaledVector(UP, -h * 0.03);
    });
  }, [], 0);
  tl.to(push, { k: 1, duration: T.dip, ease: 'none' }, 0);
  tl.to(clouds.fade, { k: 1, duration: 0.6, ease: 'power1.out' }, 0);
  tl.to(dome.fade, { k: 1, duration: 0.4, ease: 'power1.out' }, 0);
  tl.to(A, { beat: 1, duration: 0.3, ease: 'power2.out' }, 0);
  // The wind all around draws in toward it
  const inflow = { k: 0 };
  tl.call(() => {
    const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      inflow.k += dt;
      if (inflow.k < 0.045) return;
      inflow.k = 0;
      sc.vfx.emit({ pos: sc.center(side), count: lo ? 3 : 6, color: [WHITE, CYAN_HI, CYAN], speed: [5, 8], inward: true, life: [0.2, 0.32], size: [0.04, 0.09], sizeEnd: 0.5, drag: 0, intensity: 0.7 });
    });
    m.layers.push(layer);
    tl.call(() => layer.kill(), [], T.launch);
  }, [], 0.05);

  // ② Eagle cry: mouth open and head thrown back, crest feathers raised; sound waves burst out in front of the mouth
  tl.to(A, { cry: 1, duration: 0.12, ease: 'back.out(2)' }, T.cry);
  tl.call(() => {
    screech(1, 0.14);
    eyeGlint(c, GOLD, 1.0);
    sc.rig.addTrauma(0.22);
    void cine.pulse({ radial: 0.45 }, { radial: 0 }, 0.5);
    const mouth = anchorPos(c, 'mouth', () => sc.head(side));
    const out = g.f.clone().add(new THREE.Vector3(0, 0.35, 0)).normalize();
    for (let i = 0; i < 2; i++) void c.wait(0.12 + i * 0.12).then(() => ringFx(c, anchorPos(c, 'mouth', () => mouth), CYAN_HI, h * 0.1, h * (0.9 + i * 0.4), 0.4, 0.55, 0.08, out));
    cine.shock(mouth, 0.5, 0.45, 0.6);
  }, [], T.cry + 0.02);
  tl.to(A, { cry: 0, duration: 0.16, ease: 'power2.inOut' }, T.cryEnd);

  // ③ Gathering: a sink downward
  tl.call(() => {
    m.fl.on = true;
    flightFromRest(c);
  }, [], T.dip - 0.01);
  const dip = { k: 0 };
  const rest = new THREE.Vector3();
  tl.call(() => rest.copy(m.fl.pos), [], T.dip);
  tl.to(dip, { k: 1, duration: T.launch - T.dip, ease: 'power2.out', onUpdate: () => m.fl.pos.copy(rest).addScaledVector(UP, -h * 0.12 * dip.k) }, T.dip);

  // ④ Skyward climb: one downstroke, shooting straight up, bursting through the cloud layer overhead and vanishing into the light at the zenith
  const climb = { k: 0 };
  const from = new THREE.Vector3();
  tl.call(() => {
    from.copy(m.fl.pos);
    gust(1);
    ultSfx.thump(0.5);
    playOr(climbUrl, () => {
      sfx.whooshBig();
      synth.noise({ type: 'highpass', f0: 600, f1: 7000, dur: 0.7, gain: 0.3, attack: 0.1 });
    }, { gain: 0.75, delay: 0.04 });
    sc.rig.addTrauma(0.35);
    const ground = g.home.clone().setY(0.1);
    void ringFx(c, ground, CYAN_HI, h * 0.3, h * 2.6 + 1.2, 0.5, 0.7, 0.1);
    sc.vfx.smoke({ pos: ground.clone().setY(0.2), count: lo ? 14 : 28, color: [0xdce8f6, 0xc2d2e6], speed: [4, 7], life: [0.5, 0.9], size: [0.3, 0.55], sizeEnd: 1.0, radius: h * 0.4, gravity: -1, drag: 2.5 });
    zenithGlare(c, g.top.clone().add(new THREE.Vector3(0, 12, 0)), 22, 1.0);
    // The camera retreats to the ground at a low angle on the audience side and pans up after it; the eagle climbs faster and faster and rises out of the top edge of the frame
    const camPos = cine.orbitPos(side, g.home, 58, h * 1.9 + 2.0, 0).setY(0.35);
    cine.track(() => m.fl.pos, ['vig', 'radial']);
    void cine.look({ fov: port ? 1.35 : 1.2, radial: 0.2 }, 0.3);
    const p0 = sc.rig.pos.clone();
    const lk = sc.center(side);
    const tgt = new THREE.Vector3();
    let tt = 0;
    ride(c, (pos, look, dt) => {
      tt += dt;
      const k = Math.min(1, tt / 0.22);
      pos.lerpVectors(p0, camPos, ease.outCubic(k));
      // The look-at point chases it upward (half a beat behind), panning up at most to below the cloud layer: it climbs faster and faster, and finally passes through the gap in the clouds and out of the frame
      tgt.copy(m.fl.pos).addScaledVector(UP, h * 0.1);
      tgt.y = Math.min(tgt.y, g.cloudY - 0.6);
      lk.lerp(tgt, 1 - Math.exp(-dt * 10));
      look.copy(lk);
    });
  }, [], T.launch);
  tl.to(climb, {
    k: 1,
    duration: T.climb,
    ease: 'power2.in',
    onUpdate: () => {
      m.fl.pos.lerpVectors(from, g.top, climb.k);
      m.fl.pitch = -0.5 * Math.min(1, climb.k * 3);
    },
  }, T.launch);
  // Bursting through the cloud layer (at 70% of the climb)
  tl.to(clouds.split, { k: 1, duration: 0.5, ease: 'power2.out' }, T.launch + T.climb * 0.7);
  tl.call(() => {
    const p = g.home.clone().setY(g.cloudY);
    sc.vfx.smoke({ pos: p, count: lo ? 10 : 22, color: [0xf2f6ff, 0xdce6f4], speed: [3, 6], life: [0.4, 0.8], size: [0.8, 1.4], sizeEnd: 1.4, radius: 1.2, drag: 2, gravity: 0 });
    synth.noise({ type: 'lowpass', f0: 700, f1: 150, dur: 0.35, gain: 0.3 });
  }, [], T.launch + T.climb * 0.72);
  // Air currents sweeping past its sides as it climbs
  tl.call(() => {
    let acc = 0;
    const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      acc += dt;
      if (acc < 0.04) return;
      acc = 0;
      sc.vfx.emit({ pos: m.fl.pos, count: lo ? 3 : 6, color: [WHITE, CYAN_HI], speed: [10, 16], dir: new THREE.Vector3(0, -1, 0), spread: 0.25, life: [0.18, 0.3], size: [0.04, 0.1], sizeEnd: 0.1, radius: h * 0.5, drag: 0, intensity: 0.7 });
    });
    m.layers.push(layer);
    tl.call(() => layer.kill(), [], T.shadow);
  }, [], T.launch + 0.05);

  // ⑤ Shadow falls: from the opponent's front diagonal at half-height, looking down on a patch of grass; a huge eagle shadow sweeps across from the caster's side and passes over the opponent; the wind rings tighten and lock on
  const SH = T.orbit - T.shadow;
  let shadow: { k: number; kill(): void } | undefined;
  const sk = { k: 0 };
  tl.to(sk, { k: 1, duration: SH * 1.3, ease: 'none', onUpdate: () => void (shadow && (shadow.k = sk.k)), onComplete: () => shadow?.kill() }, T.shadow);
  tl.call(() => {
    m.fl.pos.copy(g.top).add(new THREE.Vector3(0, 30, 0));
    const hf = g.hf;
    const fs = g.fs;
    // Looking down obliquely from high up: the shape of the shadow can only be recognized on the ground, and the opponent also looks small
    const lookAt = g.foe.clone().addScaledVector(g.f, -0.9).setY(hf * 0.2);
    const camPos = g.foe.clone().addScaledVector(g.a, fs * 1.2 + 3.6).addScaledVector(g.f, -1.4).setY(fs * 1.1 + 3.2);
    cine.cut(camPos, lookAt);
    void cine.shot(camPos.clone().lerp(lookAt, 0.12), lookAt.clone().add(new THREE.Vector3(0, hf * 0.1, 0)), SH, ease.outQuad);
    void cine.look({ fov: port ? 1.3 : 1.12, radial: 0, roll: port ? 0 : 0.05 }, 0);
    cine.track(() => sc.center(foe), ['vig', 'radial']);
    const span = Math.max(8, hf * 4.2);
    const dir = g.f.clone().addScaledVector(g.a, 0.1).normalize();
    shadow = shadowPass(c, g.foe.clone().addScaledVector(dir, -7.5), dir, 15, span);
    playOr(passUrl, () => sfx.whooshBig(), { gain: 0.9, peakIn: 0.26 });
    screech(0.3, undefined, 0.86);
  }, [], T.shadow);
  // Grass clippings and dust on the ground swept forward as the shadow passes
  tl.call(() => {
    const at = g.foe.clone().addScaledVector(g.f, -1.6).setY(0.15);
    sc.vfx.emit({ pos: at, count: low(c) ? 10 : 24, color: [0x9ccf6a, 0xc8e39a, 0xe6e0c8], speed: [4, 8], dir: g.f.clone().add(new THREE.Vector3(0, 0.35, 0)).normalize(), spread: 0.5, life: [0.4, 0.7], size: [0.06, 0.12], atlas: 3, spin: 6, radius: g.hf * 1.2, gravity: 1.5, drag: 1.2, intensity: 0.5 });
  }, [], T.shadow + SH * 0.4);
  // The frame dims at the moment the shadow passes over the opponent
  tl.call(() => void cine.look({ tint: 0xa4aed4 }, 0.1), [], T.shadow + SH * 0.5);
  tl.call(() => void cine.look({ tint: 0xdfe8f8 }, 0.3), [], T.shadow + SH * 0.72);
  tl.call(() => {
    synth.tone({ type: 'sine', f0: 52, dur: 0.22, gain: 0.35 });
    synth.tone({ type: 'sine', f0: 50, dur: 0.22, gain: 0.3, delay: 0.24 });
  }, [], T.shadow + SH * 0.5);
  tl.call(() => {
    const hf = g.hf;
    for (let i = 0; i < 2; i++) void ringFx(c, g.foe.clone().setY(0.08), i ? CYAN_HI : CYAN, hf * 1.9 + 1.4, hf * 0.45 + 0.3, 0.32 + i * 0.06, 0.8, 0.07);
    synth.tone({ type: 'sine', f0: 1760, dur: 0.1, gain: 0.06 });
    synth.tone({ type: 'sine', f0: 2349, dur: 0.14, gain: 0.06, delay: 0.1 });
  }, [], T.shadow + SH * 0.68);

  // ⑥ Zenith circling: gliding with spread wings above the sea of clouds; the camera sweeps an arc around it, rising from looking up from outside and below to behind and above it, looking down through the sea of clouds to see the opponent
  const orbit = { k: 0 };
  const P = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const inward = new THREE.Vector3();
  const setGlide = (k: number) => {
    const th = g.th0 + (g.th1 - g.th0) * k;
    circleAt(g, th, P, tan);
    m.fl.pos.copy(P).add(new THREE.Vector3(0, Math.sin(k * Math.PI) * 0.4, 0));
    m.fl.yaw = yawOf(tan);
    // Pressing the wing toward the center of the circle: the roll direction depends on which side of it the circle's center is
    inward.copy(g.C).sub(P).setY(0).normalize();
    const localX = new THREE.Vector3(Math.cos(m.fl.yaw), 0, -Math.sin(m.fl.yaw));
    m.fl.roll = -Math.sign(inward.dot(localX)) * 0.42;
    m.fl.pitch = 0.05;
  };
  tl.call(() => {
    A.beat = 0;
    A.cry = 0;
    A.glide = 1;
    setGlide(0);
    clouds.split.k = 1;
    playOr(windUrl, () => synth.noise({ type: 'bandpass', f0: 1200, f1: 2600, q: 0.8, dur: 1.0, gain: 0.25, attack: 0.3 }), { gain: 0.55 });
    synth.tone({ type: 'sine', f0: 3200, f1: 3500, dur: 0.8, gain: 0.02, attack: 0.3 });
    void cine.look({ fov: port ? 1.35 : 1.25, roll: 0, radial: 0, vignette: 0.5, tint: 0xe4ecfa }, 0);
    cine.track(() => m.fl.pos, ['vig']);
    const D0 = h * 2.4 + 1.6;
    const D1 = h * 2.2 + 2.2;
    const t2 = new THREE.Vector3();
    const r2 = new THREE.Vector3();
    const dir = new THREE.Vector3();
    ride(c, (pos, look) => {
      const k = orbit.k;
      const e = ease.inOutQuad(k);
      const th = g.th0 + (g.th1 - g.th0) * k;
      circleAt(g, th, r2, t2);
      const rOut = r2.clone().sub(g.C).setY(0).normalize();
      const yaw = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(28, -72, e));
      const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-22, 36, e));
      const D = THREE.MathUtils.lerp(D0, D1, e);
      dir.copy(rOut).multiplyScalar(Math.cos(yaw)).addScaledVector(t2, Math.sin(yaw)).multiplyScalar(Math.cos(elev)).addScaledVector(UP, Math.sin(elev));
      pos.copy(m.fl.pos).addScaledVector(dir, D);
      // Finally looking down: the look-at point moves three-tenths of the way from the eagle toward the opponent, the eagle in the upper part of the frame and the opponent in the gap in the clouds
      look.copy(m.fl.pos).lerp(g.foe, 0.14 * e * e);
    });
  }, [], T.orbit);
  tl.to(orbit, { k: 1, duration: T.windup - T.orbit, ease: 'none', onUpdate: () => setGlide(orbit.k) }, T.orbit);
  tl.set({}, {}, T.windup);
  await playTimeline(tl);
}

/** Roll and tuck → Skyfall: follow along the dive curve; finally cut to the target's view, stopping the moment before it slams into the opponent */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, foe } = c;
  const m = mem(c);
  const g = m.g;
  if (!g) return;
  const A = act(c);
  const h = g.h;
  const lo = low(c);
  const port = sc.portrait;
  const curve = g.dive;
  const S = curve.getPoint(0);
  const DIVE = T.deliver - T.flip;
  const dive = { u: 0 };
  const tan = new THREE.Vector3();
  const dirNow = () => curve.getTangent(Math.min(0.999, Math.max(0.001, dive.u)), tan).clone();
  const yaw0 = yawOf(curve.getPoint(1).sub(S).setY(0));
  const trail = m.trail ?? makeTrail(c, curve, 0.05 + h * 0.035);
  m.trail = trail;
  const cone = m.cone ?? vaporCone(c, h, dirNow);
  const flip = { k: 0, p0: 0, r0: 0, y0: 0 };

  const tl = sc.gs.timeline('world');
  // ① Roll and tuck: the nose presses down and both wings fold
  tl.call(() => {
    flip.p0 = m.fl.pitch;
    flip.r0 = m.fl.roll;
    flip.y0 = m.fl.yaw;
    eyeGlint(c, GOLD, 0.8);
    synth.noise({ type: 'bandpass', f0: 2400, f1: 900, q: 1.5, dur: 0.12, gain: 0.3 });
    synth.noise({ type: 'lowpass', f0: 800, f1: 200, dur: 0.18, gain: 0.25 });
    // The camera stops behind and above it and turns with it
    const rel = sc.rig.pos.clone().sub(m.fl.pos);
    const lk = sc.rig.look.clone().sub(m.fl.pos);
    ride(c, (pos, look) => {
      pos.copy(m.fl.pos).add(rel);
      look.copy(m.fl.pos).add(lk);
    });
  }, [], 0);
  tl.to(A, { tuck: 1, duration: T.flip, ease: 'power2.in' }, 0);
  const d0 = curve.getTangent(0.02).clone();
  const pitch0 = Math.atan2(-d0.y, Math.hypot(d0.x, d0.z));
  tl.to(flip, {
    k: 1,
    duration: T.flip,
    ease: 'power2.inOut',
    onUpdate: () => {
      m.fl.pitch = THREE.MathUtils.lerp(flip.p0, pitch0, flip.k);
      m.fl.roll = THREE.MathUtils.lerp(flip.r0, 0, flip.k);
      // Turn through the shorter side of the angle
      let dy = yaw0 - flip.y0;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      m.fl.yaw = flip.y0 + dy * flip.k;
    },
  }, 0);

  // ② Skyfall: it drops with initial speed from the moment the wings fold, faster and faster. The camera falls along on the audience side but cannot catch up:
  //    at first it hugs its side looking at its profile, with clouds sweeping upward layer by layer; then it is left behind and above, watching it grow smaller toward the opponent below
  const booms = 1 + m.alt;
  tl.call(() => {
    playOr(diveUrl, () => {
      synth.noise({ type: 'bandpass', f0: 300, f1: 5000, q: 1.2, dur: DIVE, gain: 0.45, attack: DIVE * 0.7 });
      synth.tone({ type: 'sawtooth', f0: 160, f1: 1100, dur: DIVE, gain: 0.06, attack: DIVE * 0.6 });
    }, { gain: 0.85, endIn: DIVE });
    void cine.look({ fov: port ? 1.5 : 1.4, radial: 0.16, lines: 0.3, linesColor: CYAN_HI }, DIVE * 0.75, ease.inQuad);
    cine.track(() => m.fl.pos, ['radial', 'vig']);
    const toFoe = new THREE.Vector3();
    ride(c, (pos, look) => {
      const u = dive.u;
      diveCam(g, u, pos);
      // Look slightly ahead of it; in the later part shift toward the opponent, the opponent slowly entering the bottom edge of the frame
      const d = dirNow();
      look.copy(m.fl.pos).addScaledVector(d, h * 0.3 + u * 0.8);
      toFoe.copy(g.foe).setY(g.hf * 0.5);
      look.lerp(toFoe, 0.22 * THREE.MathUtils.smoothstep(u, 0.3, 0.7));
    });
  }, [], T.flip);
  tl.to(dive, {
    u: 1,
    duration: DIVE,
    ease: diveEase,
    onUpdate: () => {
      const u = dive.u;
      m.diveU = u;
      curve.getPoint(u, m.fl.pos);
      const d = dirNow();
      m.fl.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z));
      trail.set(u);
      cone.set(Math.min(1, Math.max(0, (u - 0.18) / 0.12)));
    },
  }, T.flip);
  // Head-on wind streaks: spawned ahead of it and at its sides and stretching backward, sweeping upward one by one as the camera falls along
  tl.call(() => {
    let acc = 0;
    let n = 0;
    const sideV = new THREE.Vector3();
    const upV = new THREE.Vector3();
    const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      acc += dt;
      if (acc < (lo ? 0.05 : 0.022)) return;
      acc = 0;
      const d = dirNow();
      sideV.crossVectors(d, g.a);
      if (sideV.lengthSq() < 1e-4) sideV.copy(g.f);
      sideV.normalize();
      upV.crossVectors(sideV, d).normalize();
      for (let i = 0; i < (lo ? 1 : 2); i++) {
        const ang = hash(++n) * Math.PI * 2;
        const r = h * (0.6 + hash(n * 1.37) * 1.8);
        const p = m.fl.pos.clone().addScaledVector(sideV, Math.cos(ang) * r).addScaledVector(upV, Math.sin(ang) * r).addScaledVector(d, h * (0.4 + hash(n * 2.11) * 2.2));
        const L = 3.5 + dive.u * 5;
        void sc.vfx.streak(p, p.clone().addScaledVector(d, -L), hash(n * 3.3) > 0.4 ? WHITE : CYAN_HI, 0.025 + hash(n * 4.7) * 0.03, 1.4 + dive.u * 1.6, 0.2);
      }
    });
    m.layers.push(layer);
    tl.call(() => layer.kill(), [], T.deliver);
  }, [], T.flip + 0.02);
  // Wake, afterimage-like air currents
  tl.call(() => {
    let acc = 0;
    const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      acc += dt;
      if (acc < 0.03) return;
      acc = 0;
      const d = dirNow();
      sc.vfx.emit({ pos: m.fl.pos, count: lo ? 3 : 7, color: [WHITE, CYAN_HI, CYAN], speed: [2, 5], dir: d.clone().negate(), spread: 0.35, life: [0.2, 0.4], size: [0.06, 0.16], sizeEnd: 0.3, radius: h * 0.3, drag: 1.5, intensity: 0.65 });
    });
    m.layers.push(layer);
    tl.call(() => layer.kill(), [], T.deliver);
  }, [], T.flip);
  // Passing through the sea of clouds: the clouds at its sides are blasted apart
  const uCloud = (() => {
    for (let i = 0; i <= 50; i++) if (curve.getPoint(i / 50).y < g.cloudY) return i / 50;
    return 0.4;
  })();
  const tCloud = T.flip + DIVE * diveTime(uCloud);
  tl.call(() => {
    sc.vfx.smoke({ pos: curve.getPoint(uCloud), count: lo ? 10 : 24, color: [0xf2f6ff, 0xdce6f4], speed: [4, 8], life: [0.35, 0.7], size: [0.8, 1.5], sizeEnd: 1.5, radius: 1.4, drag: 2.5, gravity: 0 });
    synth.noise({ type: 'lowpass', f0: 900, f1: 200, dur: 0.3, gain: 0.3 });
  }, [], tCloud);
  // Sonic boom: one ring per level of altitude (at least one ring)
  for (let i = 0; i < booms; i++) {
    const u = 0.5 + i * 0.09;
    const tb = T.flip + DIVE * diveTime(u);
    tl.call(() => {
      const at = curve.getPoint(u);
      const d = curve.getTangent(u);
      void ringFx(c, at, WHITE, h * 0.3, h * (1.6 + i * 0.3) + 1.4, 0.34, 0.9, 0.09, d);
      void ringFx(c, at.clone().addScaledVector(d, -h * 0.3), CYAN, h * 0.25, h * 1.2 + 1.0, 0.3, 0.8, 0.14, d);
      sc.vfx.emit({ pos: at, count: lo ? 16 : 36, color: [WHITE, CYAN_HI], speed: [6, 12], life: [0.22, 0.4], size: [0.07, 0.16], sizeEnd: 0.02, radius: h * 0.3, drag: 2, intensity: 0.75 });
      boom(i ? 0.6 : 1);
      cine.shock(at, 0.8, 0.45, 0.6);
      sc.stage.chromatic(0.6);
      sc.rig.addTrauma(0.3);
      void cine.pulse({ radial: 0.5 }, { radial: 0.22 }, 0.25);
    }, [], tb);
  }
  // ③ Cut to the target's view: behind the opponent, audience side, looking up from the ground, the eagle slamming down from the gap in the clouds along its trail
  tl.call(() => {
    const hf = g.hf;
    const fs = g.fs;
    const camPos = g.foe.clone().addScaledVector(g.f, fs * 0.7 + 1.2).addScaledVector(g.a, fs * 1.0 + 2.2).setY(0.5);
    const look = g.foe.clone().setY(hf * 0.5).lerp(curve.getPoint(0.55), 0.22);
    cine.cut(camPos, look);
    void cine.shot(camPos.clone().lerp(look, 0.08), look, 0.35, ease.outQuad);
    void cine.look({ fov: port ? 1.4 : 1.3, roll: port ? 0 : -0.05, lines: 0.2, radial: 0.25 }, 0);
    cine.track(() => sc.center(foe), ['radial', 'vig']);
  }, [], T.cutHit);
  tl.set({}, {}, T.deliver);
  await playTimeline(tl);
  cone.set(0);
}

/** The eagle pulls up from the impact point and flies back to its place in a big spiral with spread wings (world clock); arrives home in dur seconds */
function flyHome(c: UltCtx, from: THREE.Vector3, dur: number): void {
  const { sc } = c;
  const m = mem(c);
  const g = m.g;
  if (!g) return;
  const A = act(c);
  const h = g.h;
  const home = g.home.clone().setY(g.py);
  // After slamming in it bounces back and up (one big downstroke), glides in an arc high on the caster's side, then lands back in place
  const up = from.clone().addScaledVector(g.f, -(h * 0.9 + 0.8)).addScaledVector(g.a, 0.7).setY(from.y + g.hf * 0.8 + 2.6);
  const mid = g.home.clone().lerp(g.foe, 0.3).addScaledVector(g.a, 1.8).setY(up.y + 0.6);
  const path = new THREE.CatmullRomCurve3([from.clone(), up, mid, home.clone().add(new THREE.Vector3(0, 0.7, 0)), home], false, 'centripetal');
  const k = { u: 0 };
  const tan = new THREE.Vector3();
  const tl = sc.gs.timeline('world');
  m.homing = tl;
  tl.to(A, { tuck: 0, duration: 0.2, ease: 'power2.out' }, 0);
  tl.to(A, { beat: 1, duration: 0.2 }, 0);
  tl.to(A, { glide: 0.35, duration: 0.25 }, 0);
  tl.call(() => gust(0.7), [], 0.05);
  tl.to(k, {
    u: 1,
    duration: dur,
    ease: 'power2.out',
    onUpdate: () => {
      path.getPointAt(k.u, m.fl.pos);
      path.getTangentAt(Math.min(0.999, k.u), tan);
      const horiz = Math.hypot(tan.x, tan.z);
      // The last stretch turns back to face the opponent
      const face = yawOf(g.f);
      const yv = horiz > 0.2 ? yawOf(tan) : m.fl.yaw;
      const w = THREE.MathUtils.smoothstep(k.u, 0.75, 1);
      let dy = face - yv;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      m.fl.yaw = yv + dy * w;
      m.fl.pitch = THREE.MathUtils.lerp(-Math.atan2(tan.y, horiz) * 0.6, 0, w);
      m.fl.roll = 0;
    },
  }, 0);
  tl.to(A, { glide: 0, beat: 0, duration: 0.35, ease: 'power1.inOut' }, dur - 0.3);
  tl.call(() => screech(0.45), [], dur * 0.45);
  tl.call(() => {
    restPose(c);
    m.homing = undefined;
  }, [], dur);
}

/** Impact: inverted frame, the sky splits open along the trail, crossed slash marks, rubble and feathers; the camera holds on the hit-stop and then retreats */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe } = c;
  const m = mem(c);
  const g = m.g;
  if (!g) return;
  const lo = low(c);
  const hf = g.hf;
  const pos = sc.center(foe);
  const foeGround = sc.slots[foe].home.clone();
  if (ev.hitIndex < ev.hits) return;
  // After the director's white flash: two black-and-white inverted impact frames, then replaced with a pale blue flash (covering the director's white flash)
  // Bloom pressed low: the director's white slash marks and flash will not blur into one white sheet in the close-up
  void cine.look({ invert: 1, desat: 1, bloom: 0.18 }, 0);
  void sc.tw.wait(0.07, 'real').then(() => cine.look({ invert: 0, desat: 0 }, 0));
  sc.stage.screenFlash(0x9fc8ff, 0.2, 8);
  sc.stage.hitStop(220);
  sfx.impactBig();
  playOr(slamUrl, () => {
    synth.noise({ type: 'lowpass', f0: 1800, f1: 70, dur: 0.8, gain: 0.55 });
    synth.tone({ type: 'sine', f0: 80, f1: 30, dur: 0.8, gain: 0.55 });
  }, { gain: 0.9 });
  synth.noise({ type: 'highpass', f0: 5000, f1: 1500, dur: 0.45, gain: 0.25 });
  ultSfx.shing(0.7);
  // The opponent is struck the color of the sky (covering the director's white flash)
  sc.slots[foe].creature?.setFlash(0x3f78d8, 0.62);
  // Rift: the sky splits open along the trail
  skySplit(c, g.dive, 0.2 + g.h * 0.08, 1.5);
  m.trail?.flare();
  // Ground: cracks, shockwave ring, dust swept outward, rubble sprayed upward
  crater(c, foeGround, hf * 1.4 + 2.6, 2.4);
  // The shockwave ring on the ground must not be larger than the distance from the camera to the opponent, otherwise it would wrap around beside the camera and become a white arc filling the frame
  const camD = Math.hypot(sc.stage.camera.position.x - foeGround.x, sc.stage.camera.position.z - foeGround.z);
  void ringFx(c, foeGround.clone().setY(0.1), CYAN, 0.5, Math.min(hf * 2.4 + 3, camD * 0.7), 0.5, 0.4, 0.06);
  void ringFx(c, foeGround.clone().setY(0.12), CYAN_HI, 0.3, Math.min(hf * 1.6 + 2, camD * 0.5), 0.4, 0.35, 0.08);
  sc.vfx.smoke({ pos: foeGround.clone().setY(0.3), count: lo ? 16 : 34, color: [0x9db0c8, 0xc4d2e2, 0xb8ab94], speed: [6, 13], life: [0.5, 0.95], size: [0.28, 0.5], sizeEnd: 1.1, radius: hf * 0.5, gravity: -0.3, drag: 2.5 });
  rocks(c, foeGround, hf * 0.9 + 0.9);
  // Feathers: large solid feathers and small feather scraps
  const burst = m.fl.pos.clone();
  feathers(c, burst, lo ? 4 : 9, 0.32 + g.h * 0.12, 2.8);
  sc.vfx.emit({ pos: burst, count: lo ? 12 : 26, color: [WHITE, CYAN_HI, 0x9fc4ff], speed: [3, 7], life: [1.0, 1.8], size: [0.14, 0.26], atlas: 3, spin: 5, radius: hf * 0.3, gravity: -0.6, drag: 1.8, intensity: 0.6 });
  cine.shock(pos, 1.3, 0.7, 1.3);
  void cine.pulse({ radial: 0.8, lines: 0.35 }, { radial: 0, lines: 0 }, 0.5);
  cine.track(() => sc.center(foe), ['vig']);
  // The impact frames hold at the target's view; afterwards it retreats back and up, so the eagle pulling up and the whole impact area can be seen
  void c.wait(0.32).then(() => {
    const r = sc.rig;
    // A long opponent (the whale) retreats a bit more and is viewed lower, so that the lower edge of its body is not cut off by the bottom of the frame
    const long = g.fs - hf;
    const look = r.look.clone().add(new THREE.Vector3(0, hf * 0.3 - long * 0.3, 0));
    const p = look.clone().add(r.pos.clone().sub(r.look).multiplyScalar(1.25 + long * 0.12)).add(new THREE.Vector3(0, hf * 0.35 + 0.4 + long * 0.5, 0));
    void cine.look({ fov: sc.portrait ? 1.3 : 1.18, roll: 0, lines: 0, radial: 0 }, 0.8);
    void cine.shot(p, look, 0.8, ease.outCubic);
  });
  void c.wait(1.05).then(() => settleSky(c, 0.45));
  // The eagle: after the hit-stop it pulls up from above the opponent's head and flies back to its place with spread wings
  void c.wait(0.12).then(() => flyHome(c, m.fl.pos.clone(), 1.5));
  // The clouds disperse
  const clouds = m.clouds;
  if (clouds) void sc.tw.to(0.8, (k) => (clouds.fade.k = 1 - k), ease.inQuad, 'fx');
  const dome = m.dome;
  if (dome) void c.wait(1.1).then(() => sc.tw.to(0.9, (k) => (dome.fade.k = Math.min(dome.fade.k, 1 - k)), ease.inOutQuad, 'fx'));
}

/** Wrap up the cinematic's post-processing (tint back to normal); after holding for hold seconds the camera pulls back to the wide shot, where the post-hit battle text is read. The sky color is restored slowly by after */
function settleSky(c: UltCtx, hold: number): void {
  const { sc, cine } = c;
  void cine.look({ lines: 0, radial: 0, haze: 0, isolate: 0, bloom: sc.stage.bloomBase * 0.85, tint: 0xffffff, desat: 0, vignette: 0.45 }, 0.5);
  void c.wait(hold).then(() => {
    cine.track(null);
    void sc.rig.reset(0.8);
    void cine.look({ fov: 1, roll: 0 }, 0.8);
  });
}

/** Blocked (this move ignores guard; a fallback): it hits the barrier and bounces off, pulls up and flies back to its place */
async function guarded(c: UltCtx): Promise<void> {
  const m = mem(c);
  void ultGuarded(c);
  m.trail?.flare();
  boom(0.6);
  await c.wait(0.15);
  flyHome(c, m.fl.pos.clone(), 1.3);
  await c.wait(0.4);
}

/** After a miss or a block: if it is still out there it flies back to its place, and the camera and tint return to the wide shot */
function settle(c: UltCtx): void {
  const m = mem(c);
  if (m.fl.on && !m.homing) flyHome(c, m.fl.pos.clone(), 1.2);
  const clouds = m.clouds;
  if (clouds) void c.sc.tw.to(0.6, (k) => (clouds.fade.k = Math.min(clouds.fade.k, 1 - k)), ease.inQuad, 'fx');
  const dome = m.dome;
  if (dome) void c.sc.tw.to(0.9, (k) => (dome.fade.k = Math.min(dome.fade.k, 1 - k)), ease.inOutQuad, 'fx');
  settleSky(c, 0.5);
}

/** Wrap-up: weights go to zero, sky color and fog restored, clouds disperse, the eagle returns to its place facing the opponent */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  // If it is still flying home, remove that directly and put it back in place
  if (m.homing) {
    m.homing.kill();
    m.homing = undefined;
  }
  restPose(c);
  const A = act(c);
  const tl = sc.gs.timeline('world');
  tl.to(A, { beat: 0, tuck: 0, glide: 0, cry: 0, duration: 0.3, ease: 'power1.inOut' }, 0);
  tl.call(() => void c.cine.look({ tint: 0xffffff, desat: 0 }, 0.5), [], 0);
  // If the sky dome and clouds have not finished fading, fade them out here
  if (m.dome) tl.to(m.dome.fade, { k: 0, duration: 0.4 }, 0);
  if (m.clouds) tl.to(m.clouds.fade, { k: 0, duration: 0.4 }, 0);
  tl.set({}, {}, 0.4);
  await playTimeline(tl);
  for (const l of m.layers) l.kill();
  m.layers = [];
  m.clouds = undefined;
  m.dome = undefined;
  m.trail = undefined;
}

export default defineSsr({
  windup,
  deliver,
  impact,
  guarded,
  settle,
  after,
});
