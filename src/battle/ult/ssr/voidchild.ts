// Nephe, Child of the Void: "Void Eclipse"
//
// What this cinematic is about: the void hatchling that knows only devouring spews out, all at once, everything it has eaten into its belly (the Void Belly). The obsidian shell plates bloom open, and the core pours out hundreds of small black holes (shadow orbs),
// which first whirl into a vortex around it and then rise into the sky and arrange themselves into a rotating black-hole wheel (the Eclipse). The instant the wheel stops, all the shadow orbs sweep out in arcs and slam, wave after wave,
// into the same point on the opponent; that point grows larger with every wave, and after the final volley arrives it swallows the opponent whole, collapses, and bursts open again. Nephe's shell plates slam shut.
// Model: a floating obsidian shell sphere, one big eye, a crooked broken crown, a purple-red core glowing through the shell cracks, and a wound on its back. The cinematic relies entirely on anchors (core, crown,
// mouth, eye, wound) and action weights (glare, crown, open, glow, squint), and does not look for meshes.
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed; n = Void Belly layers 0 to 5, nb = max(1, n),
// shadow orb count N = (100 + 20n) × quality multiplier)
//   windup (charge-up of 4.3 to 5.5 s)
//     0.00  Announcement: the music is pulled away, a low-frequency dull thud; letterbox, the frame fades and shifts purple. The camera hugs the ground looking up at the big eye (audience side 20°), slowly pushing in
//     0.22  Fixed on the target: the eye stops looking around, widens all at once, the slit pupil narrows to a thin line (act.glare); an eye glint flashes
//     0.45  Broken crown: the crown floats up and spins faster and faster (act.crown), the camera is carried up to the crown
//     0.80  Void Belly churning: one heartbeat per layer of Void Belly (interval 0.2), the shell plates are pushed open once, the core brighter each time, beams of light shooting from the shell cracks;
//           the camera orbits to an oblique side view (24° → 52°) and pulls back to the full body at the same time
//     TO    Shell bursts open (TO = 0.80 + nb × 0.2 + 0.08): the shell plates bloom fully open, the core blazes, and the first batch of shadow orbs (20%) spurts out of the core;
//           obsidian debris flies off, the ground cracks, the focal length jerks in once
//     TO to TF  Pouring out (1.25 + 0.08n seconds): the shadow orbs pour out of the core wave after wave (5 + n waves), whirling around Nephe into a vortex that spins faster and faster,
//           dust on the ground is sucked in and the sky darkens; the camera orbits from 52° to 82°, retreating until the whole vortex is visible
//     TF    Rising into a wheel (0.85 s): cut to a low angle looking up from the front toward the side (audience side 22°), the vortex rises into the sky and arranges itself behind Nephe into a black-hole wheel with a sunflower pattern
//           (the face of the wheel toward the opponent), and starts to spin; the camera slowly pushes in and tilts up; the inhale sound builds all the way
//     TF+0.85  Wheel formed: a ring of purple-red shockwave at the rim of the wheel, the wheel spins faster and faster, purple-red arcs crackling between the shadow orbs, the core brightening to the fullest (0.8 s)
//     TL    Lock-on: the wheel stops abruptly, all the shadow orbs flash at once; an eye glint, one crisp sound; the inhale sound cuts off on this beat; holds 0.34 s
//   deliver (2.4 to 3.3 s, plus the hit-stop of each wave of impact)
//     0.00  Barrage: no cut, staying on the wheel's signature camera position; within 0.05 to 0.7 s the whole wheel fires outward from the outer ring inward (faster and faster), the shadow orbs surging toward the camera and the
//           opponent behind it, howling past on both sides of the camera, the camera pushed back a little by the rush. Each shadow orb first flings outward, then spirals in about the axis "Nephe → impact point"
//           (the longer it flies the more it winds), trailing a purple-red tail
//     0.72  Target's view: in front of the opponent toward the audience side (146°), speed lines aimed at the impact point, the shadow orbs spiraling in from the four edges of the frame into one point;
//           if the opponent has not yet used its ultimate, an ultimate light orb in the opponent's element color is pulled out and swallowed into the black hole at the impact point (the black hole swells, a gulp)
//     0.80  First wave lands, then 14 + 2n waves in all, the interval shrinking from 0.12 s to 0.05 s; the shadow orbs of one wave are 12 ms apart:
//           each one that hits has its own impact sound, small flash and sparks, the black hole swells and the opponent shudders; the first of each wave is a heavy hit
//           (hit-stop, shake, screen shockwave, shockwave ring, black smoke, the opponent recoiling, heavy impact sound); the black hole on the impact point grows bigger wave by wave
//     AL−0.32  Cut to a side wide shot (AL = the last wave's impact): Nephe, the remaining wheel and the opponent in one frame
//     AL−0.18  Final volley: the remaining 36% of the shadow orbs on the inner ring fire at the same time and all arrive together 0.67 s later (each still with its own sound), handed to the director to play the impact
//   impact: black flash; the black hole comes down over the whole opponent and swallows it (the opponent vanishes for a beat), contracts to a point (implosion sound), then bursts open and spits the opponent back out:
//           purple-white blast of light, beams shooting in all directions, a purple-red shockwave ring, black smoke, obsidian fragments, ground cracks, a few holes bitten out of the surroundings and then stitched shut; Nephe's shell plates slam shut;
//           on the same composition, afterwards it retreats from the current position and rises a little, holds a beat, then back to the wide shot
//   guarded: the black hole hits the barrier and is pushed back, shrinking away, the shell plates close early, and Nephe squints and chokes out a puff of black fog
//   after: the crown turns back to its original place, the glare relaxes back to a curious gaze, and the core's light withdraws; the holes are stitched shut

import * as THREE from 'three';
import { playOr, preloadSamples, type SampleVoice } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import barrageUrl from '../../../audio/sfx/voidchild-barrage.mp3';
import biteUrl from '../../../audio/sfx/voidchild-bite.mp3';
import crackUrl from '../../../audio/sfx/voidchild-crack.mp3';
import crownUrl from '../../../audio/sfx/voidchild-crown.mp3';
import engulfUrl from '../../../audio/sfx/voidchild-engulf.mp3';
import gulpUrl from '../../../audio/sfx/voidchild-gulp.mp3';
import heartUrl from '../../../audio/sfx/voidchild-heart.mp3';
import hitUrl from '../../../audio/sfx/voidchild-hit.mp3';
import implodeUrl from '../../../audio/sfx/voidchild-implode.mp3';
import ripUrl from '../../../audio/sfx/voidchild-rip.mp3';
import suckUrl from '../../../audio/sfx/voidchild-suck.mp3';
import swarmUrl from '../../../audio/sfx/voidchild-swarm.mp3';
import { getSpirit } from '../../../data.ts';
import { crackTex, rayTex } from '../../../render/fxtex.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { sceneMaterial } from '../../../render/spiritToon.ts';
import { glowTex } from '../../../render/textures.ts';
import { ease } from '../../../render/tween.ts';
import { disposeFx, type FxLayer } from '../../../render/vfx.ts';
import { ELEMENT_BRIGHT, ELEMENT_COLOR } from '../../scene.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, eyeGlint } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [biteUrl, gulpUrl, suckUrl, ripUrl, engulfUrl, implodeUrl, crackUrl, crownUrl, heartUrl, swarmUrl, barrageUrl, hitUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const CRACK = 0xd02a8a;
const CRACK_HI = 0xff7ad0;
const PINK_HI = 0xffc0ec;
const VOID = 0x0e0a1c;
const OBSIDIAN = 0x2e2352;
const GOLD_HI = 0xffe2a8;
const BELLY_MAX = 5;
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};

// ───────────────────────── State ─────────────────────────

/** The geometry of the cinematic: the impact point, and the position and orientation of the wheel in the sky */
interface Layout {
  h: number;
  /** Scale of the shadow orb swarm (Nephe's height, but a large model does not let the wheel spill out of the arena) */
  u: number;
  hf: number;
  /** The horizontal direction Nephe faces the opponent */
  fwd: THREE.Vector3;
  /** Under Nephe's feet */
  base: THREE.Vector3;
  foeC: THREE.Vector3;
  /** Impact point: on the side of the opponent's body that faces Nephe */
  tgt: THREE.Vector3;
  /** Wheel center, face normal (toward the impact point) and the two basis vectors of the face */
  wc: THREE.Vector3;
  wn: THREE.Vector3;
  wr: THREE.Vector3;
  wu: THREE.Vector3;
  /** Inner and outer radius of the wheel */
  rho0: number;
  rho1: number;
  /** Radius of the black hole at the impact point when it has eaten its fill */
  massR: number;
}

interface Mem {
  belly: number;
  /** The opponent has not yet used its ultimate (Void Eclipse will take it away) */
  has: boolean;
  lay?: Layout;
  swarm?: Swarm;
  disc?: VoidDisc;
  recoil?: Recoil;
  holes?: Holes;
  hole?: BlackHole;
  layers: FxLayer[];
  /** Sequence number of the opponent being swallowed / spat back (guaranteed to be restored at wrap-up) */
  swallowTok: number;
  swallowR: number;
  /** The wheel's signature camera position (the first beat of the barrage continues from it, with no cut) */
  sig?: { pos: THREE.Vector3; look: THREE.Vector3; fov: number };
  /** Legacy model: the crown's spinner and the glowing parts (the new model uses action weights instead) */
  legacy?: { spin: { speed: number } | null; spin0: number; glows: THREE.MeshBasicMaterial[]; orig: THREE.Color[] };
}
const mem = (c: UltCtx): Mem => (c.mem.vc ??= { belly: 0, has: false, layers: [], swallowTok: 0, swallowR: 1 }) as Mem;

const heightOf = (c: UltCtx, side: 0 | 1): number => c.sc.slots[side].creature?.worldHeight ?? 1.5;

/** Nephe's action weights (only effective on the experimental model; writing them on the legacy model has no effect) */
const act = (c: UltCtx): Record<string, number> => c.sc.slots[c.side].creature?.act ?? {};

/** World position of an anchor; use fallback when the legacy model has no such anchor */
function anchorPos(c: UltCtx, name: string, fallback: () => THREE.Vector3): THREE.Vector3 {
  const cr = c.sc.slots[c.side].creature;
  const a = cr?.anchor(name);
  if (!cr || !a) return fallback();
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}
const coreAt = (c: UltCtx) => anchorPos(c, 'core', () => c.sc.center(c.side).add(v3(0, heightOf(c, c.side) * 0.1, 0)));
const crownAt = (c: UltCtx) => anchorPos(c, 'crown', () => c.sc.top(c.side).add(v3(0, -0.45, 0)));
const mouthAt = (c: UltCtx) => anchorPos(c, 'mouth', () => c.sc.head(c.side).add(v3(0, -heightOf(c, c.side) * 0.18, 0)));
const woundAt = (c: UltCtx) => anchorPos(c, 'wound', () => c.sc.center(c.side).add(v3(0, heightOf(c, c.side) * 0.3, 0)).addScaledVector(c.cine.forward(c.side), -heightOf(c, c.side) * 0.3));

/** Quality: multiplier for the number of particles, shadow orbs and beams */
function fxAmt(c: UltCtx): number {
  const q = c.sc.stage.quality;
  return q === 'low' ? 0.45 : q === 'medium' ? 0.75 : 1;
}

/** How far away to frame a region of height hgt and width wid completely (by the current field-of-view multiplier and aspect ratio) */
function fitDist(c: UltCtx, hgt: number, wid: number, fovScale: number): number {
  const { sc } = c;
  const cam = sc.stage.camera;
  const halfTan = Math.tan(THREE.MathUtils.degToRad((cam.fov / sc.stage.fovScale) * fovScale * 0.5));
  return Math.max((hgt * 0.5) / halfTan, (wid * 0.5) / (halfTan * cam.aspect));
}

/** Read the mechanic state: Void Belly layers, and whether the opponent still has an ultimate to take */
function readState(c: UltCtx): void {
  const m = mem(c);
  const me = c.view.sides[c.side];
  m.belly = Math.min(BELLY_MAX, me.team[me.active]?.marks.find((x) => x.id === 'kit:belly')?.n ?? 0);
  m.has = !c.view.sides[c.foe].ultUsed;
}

/** The opponent's main element (the color of the ultimate light orb) */
function foeElement(c: UltCtx): keyof typeof ELEMENT_COLOR {
  const sd = c.view.sides[c.foe];
  return getSpirit(sd.team[sd.active].speciesId).elements[0];
}

/** Compute the impact point and the wheel: the wheel is behind and above Nephe with its face toward the impact point, and even the lowest shadow orb is some distance above the ground */
function layout(c: UltCtx): Layout {
  const { sc, side, foe, cine } = c;
  const h = heightOf(c, side);
  const hf = heightOf(c, foe);
  const fwd = cine.forward(side);
  const base = sc.center(side).setY(0);
  const foeC = sc.center(foe);
  const foeW = sc.slots[foe].creature?.width ?? 1;
  const tgt = foeC.clone().addScaledVector(fwd, -Math.min(foeW * 0.3, hf * 0.45)).add(v3(0, hf * 0.05, 0));
  const u = Math.min(h, 2);
  const rho1 = u * 1.9;
  const rho0 = u * 0.55;
  const wc = base.clone().addScaledVector(fwd, -u * 0.8).add(v3(0, rho1 + h * 0.35, 0));
  const wn = tgt.clone().sub(wc).normalize();
  const wr = new THREE.Vector3().crossVectors(UP, wn).normalize();
  const wu = new THREE.Vector3().crossVectors(wn, wr).normalize();
  const massR = Math.min(hf * 0.22 + 0.15, 0.75);
  return { h, u, hf, fwd, base, foeC, tgt, wc, wn, wr, wu, rho0, rho1, massR };
}

/** Fallback for the legacy model: the crown's spinner speeds up and the glowing parts are pushed toward purple-red (the new model is handled by action weights, so this does nothing) */
function legacyHeat(c: UltCtx, k: number): void {
  const cr = c.sc.slots[c.side].creature;
  if (!cr || cr.lab) return;
  const m = mem(c);
  m.legacy ??= { spin: cr.spinners[0] ?? null, spin0: cr.spinners[0]?.speed ?? 0, glows: [...cr.glows], orig: cr.glows.map((g) => g.color.clone()) };
  const L = m.legacy;
  if (L.spin) L.spin.speed = L.spin0 * (1 + k * 4);
  const hi = new THREE.Color(CRACK_HI);
  L.glows.forEach((g, i) => g.color.lerpColors(L.orig[i], hi, k * 0.4).multiplyScalar(1 + k * 0.4));
}

// ───────────────────────── Camera ─────────────────────────

/** Take the camera at second at on the timeline, and for dur seconds tween from the current position to the camera position computed by target() (target is recomputed every frame, so it can follow moving things) */
function camTo(c: UltCtx, tl: gsap.core.Timeline, at: number, dur: number, easeName: string, target: (k: number, p0: THREE.Vector3, l0: THREE.Vector3) => [THREE.Vector3, THREE.Vector3]): void {
  const r = c.sc.rig;
  const st = { k: 0 };
  let tok = -1;
  const p0 = new THREE.Vector3();
  const l0 = new THREE.Vector3();
  tl.call(() => {
    tok = r.claim();
    p0.copy(r.pos);
    l0.copy(r.look);
  }, [], at);
  tl.to(st, {
    k: 1,
    duration: dur,
    ease: easeName,
    onUpdate: () => {
      if (!r.owns(tok)) return;
      const [p, l] = target(st.k, p0, l0);
      r.pos.lerpVectors(p0, p, st.k);
      r.look.lerpVectors(l0, l, st.k);
    },
  }, at);
}

/** Take the camera at second at on the timeline, and for dur seconds fn places the camera directly every frame (orbit, follow shot) */
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

// ───────────────────────── Sound ─────────────────────────

/** The sound of a bite: a crisp crack (an audio file; if absent, a short shattering noise plus a low-frequency hit) */
function crunch(pitch = 1, gain = 1, delay = 0): void {
  playOr(biteUrl, () => {
    synth.noise({ type: 'bandpass', f0: 1400 * pitch, f1: 500 * pitch, q: 1.6, dur: 0.07, gain: 0.28 * gain, delay });
    synth.tone({ type: 'square', f0: 170 * pitch, f1: 70 * pitch, dur: 0.07, gain: 0.05 * gain, delay });
  }, { gain: 0.75 * gain, rate: pitch, delay });
}

/** Heartbeat (Void Belly churning): a thud-thud, heavier and louder the later it goes */
function heartbeat(i: number): void {
  playOr(heartUrl, () => {
    synth.tone({ type: 'sine', f0: 70, f1: 38, dur: 0.18, gain: 0.35 });
    synth.tone({ type: 'sine', f0: 62, f1: 34, dur: 0.16, gain: 0.25, delay: 0.19 });
  }, { gain: 0.7 + i * 0.08, rate: 1.08 - i * 0.04 });
}

/** Swallowing: a gulp */
function gulpSfx(big: boolean): void {
  playOr(gulpUrl, () => {
    synth.tone({ type: 'sine', f0: big ? 360 : 300, f1: big ? 55 : 80, dur: big ? 0.26 : 0.14, gain: big ? 0.3 : 0.18 });
    synth.noise({ type: 'lowpass', f0: 900, f1: 200, dur: 0.12, gain: 0.12 });
  }, { gain: big ? 1.1 : 0.6, rate: big ? 0.85 : 1.15 });
}

// ───────────────────────── Holes: the frame being bitten away ─────────────────────────

interface Holes {
  /** Bite a hole near the world coordinate anchor; r is a fraction of the frame height */
  bite(anchor: THREE.Vector3, r: number, delay?: number): void;
  /** Multiplier for all holes (surges on impact) */
  surge: number;
  /** 0 to 1: stitching shut (1 = all closed) */
  knit: number;
  /** The protected subject (will not be covered by holes): world position and screen radius */
  safe: { at: () => THREE.Vector3 | null; r: number };
  clear(): void;
  kill(): void;
}

const HOLE_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HOLE_FRAG = /* glsl */ `
  uniform float uSeed; uniform float uT; uniform float uA; uniform float uPx;
  uniform vec2 uRes; uniform vec2 uSafe; uniform float uSafeR;
  varying vec2 vUv;
  float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    // Torn edge: each angular segment gets its own random radius with straight transitions between segments, like a piece ripped off by force
    float seg = (a / 6.2831853 + 0.5) * 7.0;
    float i0 = floor(seg);
    float f = fract(seg);
    float r0 = hash21(vec2(mod(i0, 7.0), uSeed));
    float r1 = hash21(vec2(mod(i0 + 1.0, 7.0), uSeed));
    float jag = 0.5 + 0.34 * mix(r0, r1, f) + 0.015 * sin(a * 17.0 + uSeed * 2.0 + uT * 0.5);
    float e = r / jag;
    float inside = 1.0 - smoothstep(0.96, 1.0, e);
    if (inside <= 0.001) discard;
    // Inside the hole: the starry sky of the Void (pinned to the screen, drifting slowly)
    vec2 s = gl_FragCoord.xy / uRes;
    vec2 sp = s * vec2(uRes.x / uRes.y, 1.0) * 26.0 + vec2(uT * 0.05, uT * 0.02);
    vec2 cell = floor(sp);
    float h = hash21(cell);
    vec2 off = vec2(hash21(cell + 7.1), hash21(cell + 3.7));
    float d = length(fract(sp) - off);
    float tw = 0.6 + 0.4 * sin(uT * 3.0 + h * 40.0);
    float star = smoothstep(0.15, 0.0, d) * step(0.7, h) * tw;
    vec3 col = vec3(0.003, 0.001, 0.008) + vec3(0.55, 0.7, 1.0) * star * 1.1 + vec3(1.0, 0.7, 0.95) * star * step(0.92, h) * 0.8;
    // Hole rim: a thin light band measured in pixels (equally thin for large and small holes), with the outermost ring leaning white
    float px = (1.0 - e) * jag * uPx;
    float rim = exp(-px / 6.0);
    float hair = exp(-px / 1.8);
    col += mix(vec3(0.72, 0.12, 0.5), vec3(1.0, 0.8, 0.95), hair) * (rim * 0.3 + hair * 0.9);
    // Protagonist safe zone: the hole fades out over Nephe
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    float safe = smoothstep(uSafeR * 0.55, uSafeR, distance(s * asp, uSafe * asp));
    gl_FragColor = vec4(col, inside * uA * safe);
  }`;

/** Hole layer: each hole is stuck on a plane in front of the camera (screen space), its center following a world-coordinate anchor; each hole is bitten larger one bite at a time */
function makeHoles(c: UltCtx): Holes {
  const { sc } = c;
  const st = sc.stage;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  const holes: { anchor: THREE.Vector3; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; born: number; r: number; bites: number }[] = [];
  const geo = new THREE.PlaneGeometry(2, 2);
  const res = new THREE.Vector2();
  const D = 0.6;
  let time = 0;
  const api: Holes = {
    surge: 1,
    knit: 0,
    safe: { at: () => null, r: 0 },
    bite(anchor, r, delay = 0) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uSeed: { value: Math.random() * 20 }, uT: { value: 0 }, uA: { value: 1 }, uPx: { value: 10 }, uRes: { value: res }, uSafe: { value: new THREE.Vector2(-9, -9) }, uSafeR: { value: 0 } },
        vertexShader: HOLE_VERT,
        fragmentShader: HOLE_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 40;
      mesh.frustumCulled = false;
      mesh.visible = false;
      group.add(mesh);
      holes.push({ anchor: anchor.clone(), mesh, mat, born: time + delay, r, bites: 2 + Math.floor(Math.random() * 3) });
    },
    clear() {
      for (const h of holes) {
        group.remove(h.mesh);
        h.mat.dispose();
      }
      holes.length = 0;
    },
    kill: () => layer.kill(),
  };
  const cam = st.camera;
  const layer = sc.vfx.layer(group, (dt) => {
    time += dt;
    cam.updateMatrixWorld();
    group.matrix.copy(cam.matrixWorld);
    group.matrixWorld.copy(cam.matrixWorld);
    st.renderer.getDrawingBufferSize(res);
    const H = D * Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5);
    const W = H * cam.aspect;
    const safeP = api.safe.at();
    const su = safeP ? st.toUv(safeP) : null;
    const safeUv = su && !su.behind ? su : null;
    const knit = api.knit;
    for (const h of holes) {
      const age = time - h.born;
      if (age < 0) {
        h.mesh.visible = false;
        continue;
      }
      // One bite at a time: a new bite every 0.09 s, the last bite with a bit of elasticity
      const k = Math.min(1, age / (h.bites * 0.09));
      const step = Math.min(h.bites, Math.floor(k * h.bites + 1)) / h.bites;
      const grow = step * (0.85 + 0.15 * ease.outBack(Math.min(1, ((age % 0.09) / 0.09) * 2)));
      const size = h.r * Math.min(1, grow) * api.surge * (1 - knit);
      const u = st.toUv(h.anchor);
      if (size <= 0.002 || u.behind) {
        h.mesh.visible = false;
        continue;
      }
      h.mesh.visible = true;
      h.mesh.position.set((u.x * 2 - 1) * W, (u.y * 2 - 1) * H, -D);
      h.mesh.scale.setScalar(size * H);
      h.mesh.updateMatrix();
      h.mesh.matrixWorld.multiplyMatrices(group.matrixWorld, h.mesh.matrix);
      h.mat.uniforms.uT.value = time + h.born;
      h.mat.uniforms.uPx.value = size * res.y;
      h.mat.uniforms.uA.value = 1 - knit * knit;
      if (safeUv) (h.mat.uniforms.uSafe.value as THREE.Vector2).set(safeUv.x, safeUv.y);
      h.mat.uniforms.uSafeR.value = safeUv ? api.safe.r : 0;
    }
  }, () => {
    geo.dispose();
    for (const h of holes) h.mat.dispose();
  });
  return api;
}

/** Bite n holes near world position at (spread along the camera's right/up directions) */
function biteAround(c: UltCtx, at: THREE.Vector3, n: number, spread: number, r: [number, number], stagger: number, sound = true): void {
  const holes = mem(c).holes;
  if (!holes) return;
  const cam = c.sc.stage.camera;
  cam.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).normalize();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.45 + Math.random() * 0.55);
    const p = at.clone().addScaledVector(right, Math.cos(a) * d).addScaledVector(up, Math.sin(a) * d * 0.75);
    const delay = i * stagger;
    holes.bite(p, r[0] + Math.random() * (r[1] - r[0]), delay);
    if (sound && i % 2 === 0) crunch(1.15 + Math.random() * 0.2, 0.45, delay);
  }
}

// ───────────────────────── The black hole at the impact point ─────────────────────────

interface BlackHole {
  pos: THREE.Vector3;
  /** Radius of the black sphere (world units) */
  r: number;
  /** Brightness of the accretion ring, halo and corona (1 is normal) */
  heat: number;
  /** Swells once each time a wave of shadow orbs hits (decays on its own) */
  kick: number;
  /** Light specks sucked toward the black hole per second (0 = no suction) */
  suck: number;
  /** Light filaments sucked in from all directions per second */
  inflow: number;
  /** Size of the accretion ring and corona relative to the black sphere */
  ring: number;
  kill(): void;
}

/** Black sphere: opaque black, star points drifting on the surface, a ring of purple-red at the edge */
function voidSphereMat(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uRim: { value: new THREE.Color(CRACK).multiplyScalar(1.3) } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; vL = normalize(position); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uT; uniform vec3 uRim; varying vec3 vN; varying vec3 vV; varying vec3 vL;
      float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      void main(){
        float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float ca = cos(uT * 0.25), sa = sin(uT * 0.25);
        vec3 l = vec3(vL.x * ca - vL.z * sa, vL.y, vL.x * sa + vL.z * ca) * 14.0;
        vec3 cell = floor(l);
        float h = hash13(cell);
        float d = length(fract(l) - 0.5 - (vec3(hash13(cell + 1.7), hash13(cell + 5.1), hash13(cell + 9.3)) - 0.5) * 0.6);
        float star = smoothstep(0.2, 0.0, d) * step(0.82, h) * (0.5 + 0.5 * sin(uT * 4.0 + h * 50.0));
        vec3 col = vec3(0.003, 0.001, 0.008) + vec3(0.6, 0.75, 1.0) * star * 0.7 + uRim * pow(f, 5.0) * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
    toneMapped: false,
  });
}

/** Accretion ring: a slanted ring of disk, fast-turning and whitish on the inner ring, dark purple and fading on the outer ring; the black sphere hides the back half of the ring */
function diskMat(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uHeat: { value: 1 }, uIn: { value: 1.15 }, uOut: { value: 3.0 } },
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uT; uniform float uHeat; uniform float uIn; uniform float uOut; varying vec3 vP;
      void main(){
        float rr = length(vP.xy);
        float x = clamp((rr - uIn) / (uOut - uIn), 0.0, 1.0);
        float ang = atan(vP.y, vP.x);
        float w = uT * 3.0 / (0.35 + rr * rr * 0.3);
        float bands = 0.62 + 0.26 * sin(ang * 3.0 + w * 2.0 + rr * 7.0) + 0.12 * sin(ang * 8.0 - w * 3.0 + rr * 15.0);
        float inner = smoothstep(0.0, 0.04, x);
        float fall = pow(1.0 - x, 1.5);
        vec3 deep = vec3(0.4, 0.07, 0.5);
        vec3 mid = vec3(1.0, 0.22, 0.64);
        vec3 hot = vec3(1.0, 0.9, 0.98);
        vec3 col = mix(deep, mid, smoothstep(1.0, 0.3, x));
        col = mix(col, hot, pow(1.0 - x, 5.0));
        float a = clamp(inner * fall * bands * (0.6 + 0.6 * uHeat), 0.0, 1.0);
        gl_FragColor = vec4(col * (1.1 + 0.5 * uHeat), a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** Halo: a thin ring of light that always faces the camera (the edge of the black hole's silhouette), with a layer of soft light outside it */
function haloMat(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uHeat: { value: 1 }, uIn: { value: 1 / 1.8 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uT; uniform float uHeat; uniform float uIn; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        if (d > 1.0) discard;
        float x = d - uIn;
        float ring = exp(-abs(x) * 55.0);
        float glow = x > 0.0 ? exp(-x * 5.0) : 0.0;
        float ang = atan(p.y, p.x);
        float flick = 0.75 + 0.25 * sin(uT * 13.0 + ang * 5.0) * sin(uT * 7.0 - ang * 3.0);
        vec3 col = vec3(1.0, 0.86, 0.97) * ring * 1.6 + vec3(1.0, 0.2, 0.62) * glow * flick;
        float a = clamp((ring + glow * 0.7) * (0.5 + 0.5 * uHeat) * smoothstep(1.0, 0.7, d), 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function makeBlackHole(c: UltCtx): BlackHole {
  const { sc } = c;
  const root = new THREE.Group();
  const smat = voidSphereMat();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), smat);
  sphere.renderOrder = 3;
  // Corona: a big patch of purple-red light behind the black sphere (the sphere blocks the middle, leaving only a ring), like a solar eclipse
  const tex = glowTex();
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(CRACK).multiplyScalar(1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const coronaHot = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(PINK_HI).multiplyScalar(1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  corona.renderOrder = 2;
  coronaHot.renderOrder = 2;
  const dmat = diskMat();
  const tilt = new THREE.Group();
  // The ring plane is roughly horizontal, tilted toward the audience side: from the side it is a slanted ellipse, wrapping around the front and back of the black sphere
  tilt.rotation.set(-Math.PI / 2 + 0.42, 0, 0.2);
  const disk = new THREE.Mesh(new THREE.RingGeometry(1.15, 3.0, 128, 1), dmat);
  disk.renderOrder = 4;
  tilt.add(disk);
  const hmat = haloMat();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hmat);
  halo.renderOrder = 4;
  root.add(corona, coronaHot, sphere, tilt, halo);
  const cam = sc.stage.camera;
  const amt = fxAmt(c);
  const tmp = new THREE.Vector3();
  let acc = 0;
  let accIn = 0;
  const bh: BlackHole = {
    pos: new THREE.Vector3(),
    r: 0,
    heat: 1,
    kick: 0,
    suck: 0,
    inflow: 0,
    ring: 1,
    kill: () => layer.kill(),
  };
  const layer = sc.vfx.layer(root, (dt, t) => {
    root.position.copy(bh.pos);
    bh.kick *= Math.exp(-dt * 11);
    const r = bh.r * (1 + bh.kick);
    root.visible = r > 0.004;
    if (!root.visible) return;
    sphere.scale.setScalar(r * (1 + Math.sin(t * 9) * 0.015));
    tilt.scale.setScalar(r * bh.ring);
    tilt.rotation.y = Math.sin(t * 0.7) * 0.06;
    halo.scale.setScalar(r * 1.8);
    halo.quaternion.copy(cam.quaternion);
    const flick = 1 + Math.sin(t * 17) * 0.04 + Math.sin(t * 5.3) * 0.05;
    corona.scale.setScalar(r * (2 + 3.2 * bh.ring) * flick);
    coronaHot.scale.setScalar(r * (1.6 + 1.1 * bh.ring) * flick);
    corona.material.opacity = Math.min(1, 0.55 + 0.3 * bh.heat);
    coronaHot.material.opacity = Math.min(1, 0.5 + 0.35 * bh.heat);
    smat.uniforms.uT.value = t;
    dmat.uniforms.uT.value = t;
    dmat.uniforms.uHeat.value = bh.heat;
    hmat.uniforms.uT.value = t;
    hmat.uniforms.uHeat.value = bh.heat;
    // Suction: light specks fly toward the black hole from all around, with a few puffs of dark purple smoke sucked in along with them
    if (bh.suck > 0) {
      acc += dt * bh.suck * amt;
      const n = Math.floor(acc);
      acc -= n;
      for (let i = 0; i < n; i++) {
        tmp.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, Math.random() - 0.5).normalize();
        const d = r * (3 + Math.random() * 3.5);
        const life = 0.35 + Math.random() * 0.25;
        const from = bh.pos.clone().addScaledVector(tmp, d);
        if (i % 4 === 3) sc.vfx.smoke({ pos: from, count: 1, color: [0x1a0c2a, 0x2a1040], speed: [d / life, d / life], dir: tmp.clone().negate(), spread: 0.02, life: [life, life], size: [r * 0.5, r * 0.8], sizeEnd: 0.1, drag: 0 });
        else sc.vfx.emit({ pos: from, count: 1, color: [CRACK, CRACK_HI, 0xffffff, 0xb070ff], speed: [d / life, d / life], dir: tmp.clone().negate(), spread: 0.02, life: [life, life], size: [0.05, 0.11], sizeEnd: 0.2, drag: 0, intensity: 1.1 });
      }
    }
    // Light being swallowed: long thin filaments of light shooting into the black hole from far away
    if (bh.inflow > 0) {
      accIn += dt * bh.inflow * amt;
      const n = Math.floor(accIn);
      accIn -= n;
      for (let i = 0; i < n; i++) {
        tmp.set(Math.random() - 0.5, (Math.random() - 0.3) * 0.9, Math.random() - 0.5).normalize();
        const from = bh.pos.clone().addScaledVector(tmp, r * (6 + Math.random() * 6));
        void sc.vfx.streak(from, bh.pos, i % 3 ? CRACK_HI : 0xd8c8ff, r * (0.05 + Math.random() * 0.05), r * 2.5, 0.32 + Math.random() * 0.15);
      }
    }
  }, () => disposeFx(root));
  return bh;
}

// ───────────────────────── Shadow orb swarm ─────────────────────────

interface Orb {
  r: number;
  /** Vortex: the two basis vectors of the orbit plane, radius, angle, angular velocity, height */
  e1: THREE.Vector3;
  e2: THREE.Vector3;
  R: number;
  ang: number;
  w: number;
  lift: number;
  /** Position on the wheel (radius and angle on the wheel's face), and the order of settling into place (0 to 0.35) */
  sr: number;
  sa: number;
  sd: number;
  /** The swarm's clock: the time it emerges from the core (Infinity = not yet born) */
  born: number;
  /** Launch time and flight seconds (Infinity = still circling) */
  fire: number;
  fly: number;
  /** Which wave it hits in (the same wave arrives together, one heavy hit per wave) */
  salvo: number;
  /** Flight: start and end points; a spiral centered on the end point (axis, two basis vectors, start distance, outward fling amount, start angle, number of turns) */
  p0: THREE.Vector3;
  p3: THREE.Vector3;
  ax: THREE.Vector3;
  b1: THREE.Vector3;
  b2: THREE.Vector3;
  d0: number;
  swing: number;
  phi0: number;
  turns: number;
  /** 0 not yet born, 1 circling or on the wheel, 2 in flight, 3 hit */
  state: 0 | 1 | 2 | 3;
  pos: THREE.Vector3;
  /** Trail: two points following closely behind (exponential smoothing), naturally bending along the path */
  t1: THREE.Vector3;
  t2: THREE.Vector3;
  flare: number;
}

interface Swarm {
  orbs: Orb[];
  /** The swarm's clock (world clock: the shadow orbs stop in midair during hit-stop) */
  t: number;
  /** Vortex spin multiplier, radius multiplier, center raised (a multiple of Nephe's height) */
  spin: number;
  tight: number;
  rise: number;
  /** 0 to 1: the vortex rises into the sky and arranges into the wheel */
  form: number;
  /** Wheel spin speed (radians per second) */
  wheelSpin: number;
  heat: number;
  /** Shadow orbs not yet launched, arranged on the wheel from the outer ring inward */
  waiting(): Orb[];
  onArrive: ((o: Orb) => void) | null;
  /** The next count shadow orbs emerge from the core one after another over over seconds */
  spawn(count: number, over: number): void;
  /** Launch after delay seconds, flying fly seconds to hit the impact point */
  launch(o: Orb, delay: number, fly: number, salvo: number): void;
  flareAll(k: number): void;
  kill(): void;
}

const ORB_VERT = /* glsl */ `
  attribute vec3 aPos; attribute float aR; attribute float aHeat;
  varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vHeat;
  void main(){
    vec3 wp = aPos + position * aR;
    vN = normal; vV = cameraPosition - wp; vL = position; vHeat = aHeat;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;
const ORB_FRAG = /* glsl */ `
  uniform float uT; uniform vec3 uRim;
  varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vHeat;
  float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  void main(){
    float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
    vec3 l = vL * 5.0;
    vec3 cell = floor(l);
    float h = hash13(cell);
    float d = length(fract(l) - 0.5);
    float star = smoothstep(0.22, 0.0, d) * step(0.85, h) * (0.5 + 0.5 * sin(uT * 5.0 + h * 40.0));
    vec3 col = vec3(0.004, 0.002, 0.01) + vec3(0.6, 0.75, 1.0) * star * 0.35 + uRim * pow(max(f, 0.0), 7.0) * (0.5 + 0.4 * vHeat);
    gl_FragColor = vec4(col, 1.0);
  }`;
// Halo and accretion disk: a plane stuck in front of the black sphere, facing the camera. In units of the sphere's radius: a thin bright photon ring around the silhouette edge, with a layer of soft light outside;
// the front half (lower half) of the flat accretion disk covers the front of the black sphere and the back half is hidden by it, so it reads as a black hole at a glance
const HALO_VERT = /* glsl */ `
  attribute vec3 aPos; attribute float aR; attribute float aHeat; attribute float aRot;
  varying vec2 vP; varying float vHeat; varying float vSeed;
  const float S = 2.6;
  void main(){
    vHeat = aHeat;
    vSeed = aRot;
    float c = cos(aRot), s = sin(aRot);
    vP = mat2(c, s, -s, c) * position.xy * S;
    vec4 mv = viewMatrix * vec4(aPos, 1.0);
    float D = max(-mv.z, 1e-3);
    mv.xyz += normalize(-mv.xyz) * aR * 1.02;
    mv.xy += position.xy * aR * S * max(-mv.z, 1e-3) / D;
    gl_Position = projectionMatrix * mv;
  }`;
const HALO_FRAG = /* glsl */ `
  uniform float uT;
  varying vec2 vP; varying float vHeat; varying float vSeed;
  void main(){
    float d = length(vP);
    if (d > 2.6) discard;
    float inside = step(d, 1.0);
    float outer = 1.0 - inside;
    float ring = exp(-abs(d - 1.03) * 34.0) * outer;
    float glow = outer * exp(-max(d - 1.0, 0.0) * 7.0);
    float rho = length(vec2(vP.x, vP.y / 0.28));
    float disk = smoothstep(1.18, 1.35, rho) * (1.0 - smoothstep(1.6, 2.35, rho));
    disk *= mix(1.0, step(vP.y, 0.0), inside);
    float ang = atan(vP.y / 0.28, vP.x);
    disk *= 0.55 + 0.45 * sin(ang * 3.0 - uT * 9.0 + vSeed * 17.0);
    float heat = 0.35 + 0.45 * vHeat;
    vec3 dcol = mix(vec3(0.8, 0.12, 0.55), vec3(1.0, 0.8, 0.95), smoothstep(1.8, 1.25, rho));
    vec3 col = vec3(1.0, 0.88, 0.97) * ring * 1.3 + vec3(0.9, 0.18, 0.6) * glow * 0.35 + dcol * disk;
    float a = clamp((ring + glow * 0.4 + disk) * heat, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
  }`;
// Trail: a band of light with width and opacity at each end, facing the camera around its own axis
const TRAIL_VERT = /* glsl */ `
  attribute vec3 aA; attribute vec3 aB; attribute vec2 aW; attribute vec2 aAl;
  varying vec2 vUv; varying float vAl;
  void main(){
    float s = position.y + 0.5;
    vec3 axis = aA - aB;
    float L = length(axis);
    vec3 ax = L > 1e-5 ? axis / L : vec3(0.0, 1.0, 0.0);
    vec3 p = mix(aB, aA, s);
    vec3 sd = normalize(cross(ax, cameraPosition - p) + vec3(1e-6, 0.0, 0.0));
    p += sd * position.x * mix(aW.y, aW.x, s);
    vUv = vec2(position.x + 0.5, s);
    vAl = mix(aAl.y, aAl.x, s);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const TRAIL_FRAG = /* glsl */ `
  varying vec2 vUv; varying float vAl;
  void main(){
    float x = abs(vUv.x * 2.0 - 1.0);
    float core = exp(-x * x * 10.0);
    vec3 col = mix(vec3(0.62, 0.1, 0.52), vec3(1.0, 0.78, 0.94), core * vAl);
    gl_FragColor = vec4(col, (1.0 - x * x) * vAl * 0.85);
  }`;

function instAttr(geo: THREE.InstancedBufferGeometry, name: string, n: number, size: number): THREE.InstancedBufferAttribute {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
  a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute(name, a);
  return a;
}

/** Shadow orb swarm: instancing draws it all at once (black spheres, halos and accretion disks, two trail segments); positions are computed on the world clock and stop in midair during hit-stop */
function makeSwarm(c: UltCtx, N: number, L: Layout): Swarm {
  const { sc } = c;
  const { h, u } = L;
  const cam = sc.stage.camera;
  const root = new THREE.Group();
  // Black sphere
  const sGeo = new THREE.InstancedBufferGeometry();
  const sphere = new THREE.SphereGeometry(1, 18, 12);
  sGeo.index = sphere.index;
  sGeo.setAttribute('position', sphere.getAttribute('position'));
  sGeo.setAttribute('normal', sphere.getAttribute('normal'));
  sGeo.instanceCount = N;
  const aPos = instAttr(sGeo, 'aPos', N, 3);
  const aR = instAttr(sGeo, 'aR', N, 1);
  const aHeat = instAttr(sGeo, 'aHeat', N, 1);
  const sMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uRim: { value: new THREE.Color(CRACK).multiplyScalar(1.4) } }, vertexShader: ORB_VERT, fragmentShader: ORB_FRAG, toneMapped: false });
  const sMesh = new THREE.Mesh(sGeo, sMat);
  sMesh.frustumCulled = false;
  sMesh.renderOrder = 3;
  // Halo and accretion disk (sharing position, radius and brightness with the black sphere)
  const hGeo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(2, 2);
  hGeo.index = quad.index;
  hGeo.setAttribute('position', quad.getAttribute('position'));
  hGeo.instanceCount = N;
  hGeo.setAttribute('aPos', aPos);
  hGeo.setAttribute('aR', aR);
  hGeo.setAttribute('aHeat', aHeat);
  const aRot = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  for (let i = 0; i < N; i++) aRot.array[i] = (hash(i * 3.7) - 0.5) * 0.9;
  hGeo.setAttribute('aRot', aRot);
  const hMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const hMesh = new THREE.Mesh(hGeo, hMat);
  hMesh.frustumCulled = false;
  hMesh.renderOrder = 5;
  // Trail: two segments per orb
  const tGeo = new THREE.InstancedBufferGeometry();
  const strip = new THREE.PlaneGeometry(1, 1);
  tGeo.index = strip.index;
  tGeo.setAttribute('position', strip.getAttribute('position'));
  tGeo.instanceCount = N * 2;
  const aA = instAttr(tGeo, 'aA', N * 2, 3);
  const aB = instAttr(tGeo, 'aB', N * 2, 3);
  const aW = instAttr(tGeo, 'aW', N * 2, 2);
  const aAl = instAttr(tGeo, 'aAl', N * 2, 2);
  const tMat = new THREE.ShaderMaterial({ vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const tMesh = new THREE.Mesh(tGeo, tMat);
  tMesh.frustumCulled = false;
  tMesh.renderOrder = 4;
  root.add(tMesh, sMesh, hMesh);

  // Each shadow orb: the vortex's orbit (the planes all tilt upward, so the whole swarm turns in the same direction), and its sunflower slot on the wheel (from inside outward)
  const orbs: Orb[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < N; i++) {
    const nrm = v3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5).add(UP).normalize();
    const e1 = new THREE.Vector3().crossVectors(nrm, Math.abs(nrm.x) < 0.9 ? X : UP).normalize();
    const e2 = new THREE.Vector3().crossVectors(nrm, e1);
    const q = (i + 0.5) / N;
    orbs.push({
      r: u * (0.075 + 0.055 * Math.random()),
      e1,
      e2,
      R: u * (0.9 + 1.1 * Math.pow(Math.random(), 0.7)),
      ang: Math.random() * Math.PI * 2,
      w: 1.4 + Math.random() * 1.2,
      lift: u * (-0.05 + 0.65 * Math.random()),
      sr: L.rho0 + (L.rho1 - L.rho0) * Math.sqrt(q),
      sa: i * 2.39996,
      sd: 0.35 * (1 - Math.sqrt(q)) + Math.random() * 0.05,
      born: Infinity,
      fire: Infinity,
      fly: 0.5,
      salvo: -1,
      p0: new THREE.Vector3(),
      p3: new THREE.Vector3(),
      ax: new THREE.Vector3(),
      b1: new THREE.Vector3(),
      b2: new THREE.Vector3(),
      d0: 1,
      swing: 0,
      phi0: 0,
      turns: 0,
      state: 0,
      pos: new THREE.Vector3(),
      t1: new THREE.Vector3(),
      t2: new THREE.Vector3(),
      flare: 0,
    });
  }
  let nextBorn = 0;
  let wheelAng = 0;
  const vc = new THREE.Vector3();
  const core = new THREE.Vector3();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const api: Swarm = {
    orbs,
    t: 0,
    spin: 1,
    tight: 1,
    rise: 0,
    form: 0,
    wheelSpin: 0,
    heat: 1,
    onArrive: null,
    waiting: () => orbs.filter((o) => o.state === 1 && o.fire === Infinity).sort((a, b) => b.sr - a.sr),
    spawn(count, over) {
      for (let k = 0; k < count && nextBorn < N; k++, nextBorn++) orbs[nextBorn].born = api.t + (over * (k + Math.random() * 0.8)) / Math.max(1, count);
    },
    launch(o, delay, fly, salvo) {
      o.fire = api.t + Math.max(0, delay);
      o.fly = fly;
      o.salvo = salvo;
    },
    flareAll(k) {
      for (const o of orbs) if (o.state === 1) o.flare = k;
    },
    kill: () => {
      off();
      layer.kill();
    },
  };
  const orbitAt = (o: Orb, out: THREE.Vector3) => {
    const R = o.R * api.tight;
    out.copy(vc).addScaledVector(o.e1, Math.cos(o.ang) * R).addScaledVector(o.e2, Math.sin(o.ang) * R);
    out.y += o.lift;
    out.y = Math.max(out.y, o.r + 0.12);
    return out;
  };
  const slotAt = (o: Orb, out: THREE.Vector3) => {
    const a = o.sa + wheelAng;
    const rr = o.sr * (1 + 0.025 * Math.sin(api.t * 3 + o.sa));
    return out.copy(L.wc).addScaledVector(L.wr, Math.cos(a) * rr).addScaledVector(L.wu, Math.sin(a) * rr);
  };
  /** Spiral convergence: closing in on the impact point along the axis while turning about the axis, first flinging outward and then pulling back (u = 0 start, 1 impact point) */
  const spiral = (o: Orb, u: number, out: THREE.Vector3) => {
    const phi = o.phi0 + o.turns * Math.PI * 2 * u;
    const sw = o.swing * Math.pow(Math.sin(Math.PI * u), 0.8);
    out.copy(o.p3).addScaledVector(o.ax, o.d0 * (1 - u)).addScaledVector(o.b1, Math.cos(phi) * sw).addScaledVector(o.b2, Math.sin(phi) * sw);
    out.y = Math.max(out.y, o.r + 0.1);
    return out;
  };
  /** Launch: flung outward from the wheel, spiraling in about the axis "Nephe → impact point"; the longer it flies the more it winds and the wider it flings, so the sense of speed does not drop off */
  const takeOff = (o: Orb) => {
    o.p0.copy(o.pos);
    o.p3.copy(L.tgt).add(v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(L.hf * 0.08));
    dir.copy(o.p0).sub(o.p3);
    o.d0 = dir.length();
    o.ax.copy(dir).divideScalar(o.d0);
    o.b1.crossVectors(o.ax, UP).normalize();
    o.b2.crossVectors(o.ax, o.b1).normalize();
    const out = tmp.copy(o.pos).sub(api.form > 0.5 ? L.wc : vc);
    o.phi0 = Math.atan2(out.dot(o.b2), out.dot(o.b1));
    const long = THREE.MathUtils.clamp((o.fly - 0.5) / 0.9, 0, 1);
    o.swing = o.d0 * (0.14 + 0.12 * Math.random() + 0.16 * long);
    o.turns = 0.12 + 0.55 * long + Math.random() * 0.1;
    o.state = 2;
    o.flare = 1.2;
    sc.vfx.emit({ pos: o.pos, count: 2, color: [CRACK_HI, 0xffffff], speed: [1, 3], life: [0.12, 0.25], size: [0.04, 0.07], drag: 3, intensity: 0.8 });
  };
  const K1 = 0.05;
  const writeTrail = (i: number, a: THREE.Vector3, b: THREE.Vector3, wa: number, wb: number, la: number, lb: number) => {
    aA.setXYZ(i, a.x, a.y, a.z);
    aB.setXYZ(i, b.x, b.y, b.z);
    aW.setXY(i, wa, wb);
    aAl.setXY(i, la, lb);
  };
  const off = sc.stage.add((wdt0) => {
    const wdt = wdt0 * sc.tw.speed;
    api.t += wdt;
    const t = api.t;
    wheelAng += api.wheelSpin * wdt;
    core.copy(coreAt(c));
    vc.copy(core).add(v3(0, h * (0.2 + api.rise), 0));
    const follow = wdt > 0 ? 1 - Math.exp(-wdt / K1) : 0;
    for (let i = 0; i < N; i++) {
      const o = orbs[i];
      let r = 0;
      if (o.state === 0 && t >= o.born) {
        o.state = 1;
        o.pos.copy(core);
        o.t1.copy(core);
        o.t2.copy(core);
        o.flare = 1.6;
      }
      if (o.state === 1 && t >= o.fire) takeOff(o);
      if (o.state === 1) {
        o.ang += o.w * api.spin * wdt;
        orbitAt(o, V);
        if (api.form > 0) {
          const f = THREE.MathUtils.clamp((api.form - o.sd) / 0.65, 0, 1);
          const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
          if (e > 0) V.lerp(slotAt(o, S), e).addScaledVector(UP, Math.sin(Math.PI * e) * h * 0.4);
        }
        const age = t - o.born;
        if (age < 0.4) {
          const k = age / 0.4;
          o.pos.lerpVectors(core, V, ease.outBack(k));
          r = o.r * Math.min(1, age / 0.12);
        } else {
          o.pos.copy(V);
          r = o.r;
        }
      } else if (o.state === 2) {
        const k = Math.min(1, (t - o.fire) / o.fly);
        spiral(o, 0.3 * k + 0.7 * k * k, o.pos);
        r = o.r;
        if (k >= 1) {
          o.state = 3;
          api.onArrive?.(o);
        }
      } else if (o.state === 3) o.pos.copy(o.p3);
      o.t1.lerp(o.pos, follow);
      o.t2.lerp(o.t1, follow);
      o.flare *= Math.exp(-wdt * 4);
      // Shadow orbs close to the camera are shrunk, so that a single black sphere does not smear over the whole frame
      const dc = o.pos.distanceTo(cam.position);
      const near = THREE.MathUtils.smoothstep(dc, 0.35, 1.2);
      r *= near;
      aPos.setXYZ(i, o.pos.x, o.pos.y, o.pos.z);
      aR.setX(i, r);
      aHeat.setX(i, api.heat + o.flare + (o.state === 2 ? 0.5 : 0));
      // Trail: after the shadow orb has already hit, the trail still closes into the impact point for a few frames
      const tr = o.state === 0 ? 0 : (o.state === 3 ? o.r : r) * near;
      const la = o.state === 3 ? 0.9 : 0.95;
      writeTrail(i * 2, o.pos, o.t1, tr * 1.3, tr * 1.0, la, 0.65);
      writeTrail(i * 2 + 1, o.t1, o.t2, tr * 1.0, tr * 0.25, 0.65, 0);
    }
    aPos.needsUpdate = true;
    aR.needsUpdate = true;
    aHeat.needsUpdate = true;
    aA.needsUpdate = true;
    aB.needsUpdate = true;
    aW.needsUpdate = true;
    aAl.needsUpdate = true;
    sMat.uniforms.uT.value = t;
    hMat.uniforms.uT.value = t;
  });
  sc.addCleanup(off);
  const layer = sc.vfx.layer(root, () => {}, () => {
    for (const g of [sGeo, hGeo, tGeo, sphere, quad, strip]) g.dispose();
    for (const mt of [sMat, hMat, tMat]) mt.dispose();
  });
  return api;
}

// ───────────────────────── Void Eclipse: the void behind the wheel ─────────────────────────

interface VoidDisc {
  /** 0 to 1: density of the void */
  a: number;
  kill(): void;
}

const DISC_FRAG = /* glsl */ `
  uniform float uT; uniform float uA;
  varying vec2 vUv;
  float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    // Slowly rotating stardust
    float a = atan(p.y, p.x) + uT * 0.35 + r * 2.5;
    vec2 sp = vec2(a * 9.0, r * 22.0);
    vec2 cell = floor(sp);
    float h = hash21(cell);
    float d = length(fract(sp) - 0.5);
    float star = smoothstep(0.25, 0.0, d) * step(0.86, h) * (0.6 + 0.4 * sin(uT * 4.0 + h * 30.0));
    vec3 col = mix(vec3(0.01, 0.004, 0.028), vec3(0.09, 0.025, 0.15), smoothstep(0.25, 0.95, r));
    col += vec3(0.75, 0.6, 1.0) * star * 0.5 * smoothstep(0.95, 0.4, r);
    // A thin purple-red glow around the disc rim
    col += vec3(0.9, 0.2, 0.62) * exp(-abs(r - 0.9) * 45.0) * 0.8;
    float alpha = smoothstep(1.0, 0.8, r) * uA * 0.92;
    gl_FragColor = vec4(col, alpha);
  }`;

/** A patch of void behind the wheel: it covers the arena background so that the bright rim of the black-hole wheel pops out (a hole eaten out of the sky) */
function makeVoidDisc(c: UltCtx, L: Layout): VoidDisc {
  const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 } }, vertexShader: HOLE_VERT, fragmentShader: DISC_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.position.copy(L.wc).addScaledVector(L.wn, -L.u * 0.35);
  m.lookAt(m.position.clone().add(L.wn));
  m.renderOrder = 1;
  const vd: VoidDisc = { a: 0, kill: () => layer.kill() };
  const layer = c.sc.vfx.layer(m, (_dt, t) => {
    m.visible = vd.a > 0.005;
    m.scale.setScalar(L.rho1 * 1.3 * (0.85 + 0.15 * vd.a));
    mat.uniforms.uT.value = t;
    mat.uniforms.uA.value = vd.a;
  });
  return vd;
}

// ───────────────────────── The opponent's hit recoil ─────────────────────────

interface Recoil {
  kick(a: number): void;
  stop(): void;
}

/** Each wave of impact: the opponent leans back, squashes and shudders, then springs back (fx clock: it still shudders during hit-stop) */
function makeRecoil(c: UltCtx): Recoil {
  const cr = c.sc.slots[c.foe].creature;
  let amt = 0;
  let t = 0;
  let on = true;
  const off = c.sc.stage.add((_dt, fxDt) => {
    if (!cr || !on) return;
    t += fxDt;
    amt *= Math.exp(-fxDt * 9);
    cr.pose.rotation.x = -amt * 0.8;
    const w = amt * 0.45;
    cr.pose.scale.set(1 + w, 1 - w, 1 + w);
    cr.pose.position.x = Math.sin(t * 95) * amt * 0.22;
  });
  const stop = () => {
    if (!on) return;
    on = false;
    off();
    if (!cr) return;
    cr.pose.rotation.x = 0;
    cr.pose.scale.set(1, 1, 1);
    cr.pose.position.x = 0;
  };
  c.sc.addCleanup(stop);
  return { kick: (a) => (amt = Math.min(0.42, amt + a)), stop };
}

// ───────────────────────── Solid VFX (scene objects: cartoon material + outline) ─────────────────────────

/** Obsidian fragments: flying outward from pos, bouncing once on landing and then shrinking away; if dir is given they lean toward that direction */
function shards(c: UltCtx, pos: THREE.Vector3, count: number, speed: number, size: number, dur = 1.3, dir?: THREE.Vector3): void {
  const { sc } = c;
  const n = Math.max(3, Math.round(count * fxAmt(c)));
  const g = new THREE.Group();
  const mats = [sceneMaterial(OBSIDIAN, { rim: 0.6 }), sceneMaterial(0x46367a, { rim: 0.6 })];
  const bits: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }[] = [];
  for (let i = 0; i < n; i++) {
    const geo = new THREE.OctahedronGeometry(1, 0);
    geo.scale(0.55 + hash(i * 3.1) * 0.5, 0.25 + hash(i * 5.3) * 0.2, 1);
    const m = new THREE.Mesh(geo, mats[i % 2]);
    m.scale.setScalar(size * (0.6 + hash(i * 7.7) * 0.8));
    m.layers.enable(INK_LAYER);
    m.userData.inkScene = true;
    m.position.copy(pos);
    const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 - 0.2, Math.random() - 0.5).normalize();
    if (dir) d.lerp(dir, 0.45).normalize();
    bits.push({ m, v: d.multiplyScalar(speed * (0.55 + Math.random() * 0.6)), w: v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(16) });
    g.add(m);
  }
  registerInkRoot(g);
  void sc.vfx.spawn(g, dur, (k, dt) => {
    for (const b of bits) {
      b.v.y -= 14 * dt;
      b.m.position.addScaledVector(b.v, dt);
      if (b.m.position.y < 0.08) {
        b.m.position.y = 0.08;
        b.v.y = Math.abs(b.v.y) * 0.3;
        b.v.x *= 0.6;
        b.v.z *= 0.6;
        b.w.multiplyScalar(0.5);
      }
      b.m.rotation.x += b.w.x * dt;
      b.m.rotation.y += b.w.y * dt;
      b.m.rotation.z += b.w.z * dt;
      if (k > 0.75) b.m.visible = hash(b.m.id) < 1 - (k - 0.75) / 0.25;
    }
  }, () => {
    for (const mt of mats) mt.dispose();
    for (const b of bits) b.m.geometry.dispose();
  });
}

// ───────────────────────── Glowing VFX (take bloom) ─────────────────────────

/** Beams shooting from the shell cracks: outward from the core, avoiding the eye straight ahead */
function beams(c: UltCtx, center: THREE.Vector3, n: number, len: number, width: number, dur: number): void {
  const { sc, side } = c;
  const fwd = c.cine.forward(side);
  const cam = sc.stage.camera;
  const count = Math.max(2, Math.round(n * fxAmt(c)));
  for (let i = 0; i < count; i++) {
    const d = new THREE.Vector3();
    for (let k = 0; k < 8; k++) {
      d.set(Math.random() - 0.5, Math.random() * 0.8 - 0.25, Math.random() - 0.5).normalize();
      if (d.dot(fwd) < 0.45) break;
    }
    const mat = new THREE.MeshBasicMaterial({ map: rayTex(), color: new THREE.Color(i % 3 ? CRACK_HI : PINK_HI).multiplyScalar(1.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const L = len * (0.6 + Math.random() * 0.6);
    void sc.vfx.spawn(m, dur, (k) => {
      a.copy(center).addScaledVector(d, len * 0.15);
      b.copy(center).addScaledVector(d, len * 0.15 + L * (0.4 + ease.outCubic(Math.min(1, k * 3)) * 0.6));
      const w = width * (1 - k * 0.6);
      const axis = b.clone().sub(a);
      const l = axis.length();
      axis.divideScalar(l);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const s = new THREE.Vector3().crossVectors(axis, cam.position.clone().sub(mid)).normalize();
      const nrm = new THREE.Vector3().crossVectors(s, axis).normalize();
      m.position.copy(mid);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(s, axis, nrm));
      m.scale.set(w, l, 1);
      mat.opacity = k < 0.15 ? k / 0.15 : Math.pow(1 - (k - 0.15) / 0.85, 1.5);
    });
  }
}

/** Glow: a brief patch of additive light (placed behind the core or the impact point, not stopping in front of the face) */
function bloomAt(c: UltCtx, pos: THREE.Vector3, color: number, size: number, dur: number): void {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.position.copy(pos);
  void c.sc.vfx.spawn(s, dur, (k) => {
    s.scale.setScalar(size * (0.7 + k * 0.6));
    s.material.opacity = Math.pow(1 - k, 2);
  });
}

// ───────────────────────── Cinematic ─────────────────────────

/** Announcement → fixed on the target → broken crown → Void Belly churning → shell bursts open → pouring out → rising into a wheel → wheel formed → lock-on */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side } = c;
  const m = mem(c);
  readState(c);
  const L = layout(c);
  m.lay = L;
  const { h, wc, rho1 } = L;
  const A = act(c);
  const port = sc.portrait;
  const fov0 = port ? 1.25 : 1;
  const n = m.belly;
  const nb = Math.max(1, n);
  const amt = fxAmt(c);
  const N = Math.round((100 + 20 * n) * amt);
  const T_GLARE = 0.22;
  const T_CROWN = 0.45;
  const T_BELLY = 0.8;
  const BEAT = 0.2;
  const T_OPEN = T_BELLY + nb * BEAT + 0.08;
  const SPAWN = 1.25 + 0.08 * n;
  const T_FORM = T_OPEN + SPAWN;
  const FORM = 0.85;
  const T_SIG = T_FORM + FORM;
  const SIG = 0.8;
  const T_LOCK = T_SIG + SIG;
  const T_END = T_LOCK + 0.34;
  const face = sc.head(side);
  const d0 = fitDist(c, h * 0.62, h * 0.62, fov0);
  const dFull = fitDist(c, h * 1.35, h * 1.45, fov0);
  const dVort = fitDist(c, L.u * 4.4, L.u * 5.6, fov0);
  const vortexAt = () => coreAt(c).add(v3(0, h * 0.45, 0));

  // Build and precompile the black hole at the impact point, the hole layer and the shadow orb swarm first (radius 0, invisible), so there is no hitch midway through the cinematic
  const bh = makeBlackHole(c);
  m.hole = bh;
  bh.pos.copy(L.tgt);
  bh.ring = 0.55;
  m.holes = makeHoles(c);
  const sw = makeSwarm(c, N, L);
  m.swarm = sw;
  const disc = makeVoidDisc(c, L);
  m.disc = disc;
  sc.stage.prewarm();

  const tl = sc.gs.timeline('world');
  // ① Announcement: the music is pulled away, the frame shifts purple; the camera hugs the ground looking up at the big eye
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    synth.dropMusic();
    synth.tone({ type: 'sine', f0: 58, f1: 32, dur: 1.7, gain: 0.32, attack: 0.05 });
    synth.noise({ type: 'lowpass', f0: 2000, f1: 120, dur: 0.6, gain: 0.18 });
    cine.track(() => sc.head(side), ['vig', 'haze']);
    void cine.look({ letterbox: 1, vignette: 0.6, desat: 0.3, isolate: 0.3, tint: 0xd0c4ff, lift: 0x000000, bloom: 0.75, grain: 0.2, fov: fov0 }, 0.35, ease.outQuad);
    cine.cut(cine.orbitPos(side, face, 20, d0, -h * 0.16), face.clone().add(v3(0, h * 0.05, 0)));
  }, [], 0);
  camTo(c, tl, 0.01, T_CROWN, 'power1.out', () => [cine.orbitPos(side, face, 18, d0 * 0.86, -h * 0.13), face.clone().add(v3(0, h * 0.05, 0))]);

  // ② Fixed on the target: the eye widens all at once, the slit pupil narrows to a thin line
  tl.to(A, { glare: 1, duration: 0.16, ease: 'power4.out' }, T_GLARE);
  tl.call(() => {
    eyeGlint(c, CRACK_HI, 1.25);
    synth.noise({ type: 'highpass', f0: 3000, f1: 9000, dur: 0.12, gain: 0.14 });
    synth.tone({ type: 'sawtooth', f0: 90, f1: 45, dur: 0.3, gain: 0.08 });
    void cine.pulse({ radial: 0.35 }, { radial: 0 }, 0.3);
    sc.rig.addTrauma(0.12);
  }, [], T_GLARE + 0.03);

  // ③ Broken crown: the crown floats up and spins faster and faster; the camera is carried up
  tl.to(A, { crown: 1, duration: 0.55, ease: 'power2.in' }, T_CROWN);
  tl.call(() => {
    playOr(crownUrl, () => {
      synth.tone({ type: 'triangle', f0: 880, f1: 1760, dur: 0.6, gain: 0.05, attack: 0.4 });
      synth.tone({ type: 'triangle', f0: 1320, f1: 2640, dur: 0.6, gain: 0.03, attack: 0.4 });
    }, { gain: 0.5, peakIn: 0.5 });
    legacyHeat(c, 0.4);
  }, [], T_CROWN);
  tl.call(() => void sc.vfx.glint(crownAt(c), GOLD_HI, h * 0.16, 0.45, 2.5), [], T_CROWN + 0.5);
  camTo(c, tl, T_CROWN, T_BELLY - T_CROWN + 0.02, 'power2.inOut', () => {
    const at = face.clone().lerp(crownAt(c), 0.45);
    return [cine.orbitPos(side, at, 24, d0 * 1.05, -h * 0.1), at];
  });

  // ④ Void Belly churning: one heartbeat per layer, the shell plates pushed open once, beams shooting from the shell cracks; the camera orbits to an oblique side view and pulls back to the full body at the same time
  camRig(c, tl, T_BELLY, T_OPEN - T_BELLY, 'power1.inOut', (k, pos, look) => {
    const core = coreAt(c);
    pos.copy(cine.orbitPos(side, core, 24 + 28 * k, d0 * 1.05 + (dFull - d0 * 1.05) * k, -h * 0.08 - h * 0.06 * k));
    look.copy(core).add(v3(0, h * 0.06 + h * 0.06 * k, 0));
  });
  tl.call(() => cine.track(() => coreAt(c), ['vig', 'haze']), [], T_BELLY);
  if (n === 0) {
    // Empty belly: the belly gurgles, and the shell plates only shudder
    tl.to(A, { open: 0.06, duration: 0.06, ease: 'power2.out' }, T_BELLY);
    tl.to(A, { open: 0, duration: 0.1, ease: 'power2.in' }, T_BELLY + 0.06);
    tl.call(() => {
      synth.tone({ type: 'sine', f0: 140, f1: 220, dur: 0.22, gain: 0.12 });
      synth.tone({ type: 'sine', f0: 220, f1: 110, dur: 0.18, gain: 0.1, delay: 0.16 });
      heartbeat(0);
    }, [], T_BELLY);
    tl.to(A, { glow: 0.3, duration: 0.15 }, T_BELLY);
  }
  for (let i = 0; i < n; i++) {
    const t = T_BELLY + i * BEAT;
    const k = i / Math.max(1, BELLY_MAX - 1);
    tl.to(A, { open: 0.12 + 0.05 * k, duration: 0.05, ease: 'power2.out' }, t);
    tl.to(A, { open: 0.02 + 0.03 * k, duration: 0.1, ease: 'power2.in' }, t + 0.05);
    tl.to(A, { glow: 0.25 + 0.5 * k, duration: 0.06, ease: 'power2.out' }, t);
    tl.call(() => {
      heartbeat(i);
      const core = coreAt(c);
      beams(c, core, 4 + i, h * 0.75, h * 0.07, 0.3);
      bloomAt(c, core, CRACK, h * (0.9 + 0.25 * k), 0.3);
      sc.rig.addTrauma(0.08 + 0.04 * k);
      void cine.pulse({ radial: 0.15 + 0.1 * k }, { radial: 0 }, 0.2);
    }, [], t);
  }

  // ⑤ Shell bursts open: the shell plates bloom fully open, the core blazes, and the first batch of shadow orbs spurts out; obsidian debris flies off, the ground cracks, the focal length jerks in once
  const first = Math.round(N * 0.2);
  tl.to(A, { open: 1, duration: 0.3, ease: 'back.out(1.6)' }, T_OPEN);
  tl.to(A, { glow: 1, duration: 0.18, ease: 'power2.out' }, T_OPEN);
  tl.call(() => {
    const core = coreAt(c);
    sw.spawn(first, 0.14);
    playOr(crackUrl, () => {
      synth.noise({ type: 'bandpass', f0: 2600, f1: 400, q: 1.2, dur: 0.35, gain: 0.35 });
      synth.tone({ type: 'sine', f0: 110, f1: 40, dur: 0.6, gain: 0.35 });
    }, { gain: 0.95 });
    playOr(swarmUrl, () => synth.noise({ type: 'bandpass', f0: 200, f1: 1400, q: 0.8, dur: SPAWN, gain: 0.2, attack: SPAWN * 0.6 }), { gain: 0.9, peakIn: SPAWN * 0.6 });
    ultSfx.thump(0.6);
    sc.rig.addTrauma(0.5);
    cine.shock(core, 0.9, 0.5, 0.7);
    void cine.pulse({ radial: 0.6, fov: fov0 * 0.86 }, { radial: 0, fov: fov0 }, 0.4);
    shards(c, core, 12, h * 2.6, h * 0.045, 1.2);
    beams(c, core, 10, h * 1.1, h * 0.09, 0.45);
    bloomAt(c, core, CRACK_HI, h * 1.6, 0.4);
    void sc.vfx.ring(core, CRACK_HI, h * 0.2, h * 1.8, 0.45, sc.stage.camera.position.clone().sub(core));
    void sc.vfx.ring(L.base.clone().setY(0.08), CRACK, h * 0.3, h * 3.2, 0.7);
    void sc.vfx.decal(L.base.clone().setY(0.04), crackTex(4), CRACK, h * 3.4, SPAWN + FORM + SIG + 3, undefined, 0.9);
    sc.vfx.emit({ pos: core, count: Math.round(40 * amt), color: [CRACK, CRACK_HI, 0xffffff], speed: [2, 6], life: [0.3, 0.6], size: [0.04, 0.1], sizeEnd: 0.2, radius: h * 0.15, drag: 2, intensity: 1 });
    legacyHeat(c, 0.8);
  }, [], T_OPEN);

  // ⑥ Pouring out: the shadow orbs pour out of the core wave after wave and whirl into a vortex; dust is sucked in and the sky darkens; the camera orbits to the side and retreats until the whole vortex is visible
  const waves = 5 + n;
  const per = (N - first) / waves;
  for (let w = 0; w < waves; w++) {
    const t = T_OPEN + 0.14 + (w * (SPAWN - 0.4)) / waves;
    const k = w / Math.max(1, waves - 1);
    tl.call(() => {
      sw.spawn(Math.round(per * (w + 1)) - Math.round(per * w), 0.16);
      const core = coreAt(c);
      bloomAt(c, core, CRACK_HI, h * (1 + 0.4 * k), 0.25);
      synth.tone({ type: 'sine', f0: 95 - 20 * k, f1: 38, dur: 0.22, gain: 0.22 + 0.08 * k });
      crunch(0.7 + 0.1 * Math.random(), 0.35);
      sc.rig.addTrauma(0.1 + 0.08 * k);
      void cine.pulse({ radial: 0.18 + 0.12 * k }, { radial: 0.05 }, 0.22);
      sc.vfx.smoke({ pos: L.base.clone().setY(0.2), count: Math.round(10 * amt), color: [0x2a2038, 0x3a3048], speed: [2, 3.5], inward: true, radius: h * 3.2, life: [0.5, 0.8], size: [0.3, 0.55], sizeEnd: 0.4, drag: 0.5 });
    }, [], t);
  }
  tl.to(sw, { spin: 1.9, rise: 0.35, duration: SPAWN, ease: 'power1.in' }, T_OPEN);
  tl.to(A, { glow: 0.85, duration: 0.3 }, T_OPEN + 0.3);
  tl.call(() => {
    cine.track(vortexAt, ['vig', 'haze']);
    void cine.look({ tint: 0xa49ce0, desat: 0.4, vignette: 0.7, isolate: 0.4, haze: 0.35, hazeRadius: 0.35 }, SPAWN, ease.inQuad);
  }, [], T_OPEN + 0.05);
  camRig(c, tl, T_OPEN, SPAWN, 'power2.out', (k, pos, look) => {
    const at = vortexAt();
    pos.copy(cine.orbitPos(side, at, 52 + 30 * k, dFull + (dVort - dFull) * k, -h * 0.2 + h * 0.15 * k));
    look.copy(at);
  });

  // ⑦ Rising into a wheel: cut to a low angle looking up from the front toward the side; the vortex rises into the sky and arranges itself behind Nephe into a rotating black-hole wheel
  // The composition is computed from elevation angles: the camera is in front of Nephe toward the audience side, close to the ground; take the two elevation angles of Nephe's feet and the wheel's top edge, aim at the middle, and the focal length just fits them
  const sigPos = cine.orbitPos(side, L.base, 26, h * 2.7, h * 0.22);
  const flat = (p: THREE.Vector3) => Math.hypot(p.x - sigPos.x, p.z - sigPos.z);
  const wTop = wc.clone().addScaledVector(L.wu, rho1 + h * 0.3);
  const aLow = Math.atan2(-h * 0.08 - sigPos.y, flat(L.base));
  const aHigh = Math.atan2(wTop.y - sigPos.y, flat(wTop));
  const lookXZ = L.base.clone().lerp(wc, 0.5);
  const sigLook = lookXZ.clone().setY(sigPos.y + Math.tan((aLow + aHigh) * 0.5) * flat(lookXZ));
  const baseFov = sc.stage.camera.fov / sc.stage.fovScale;
  const fovS = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg((aHigh - aLow) / 0.88) / baseFov, 1, port ? 2.2 : 1.9);
  m.sig = { pos: sigPos, look: sigLook, fov: fovS };
  tl.call(() => {
    cine.cut(sigPos, sigLook);
    cine.track(() => wc, ['vig', 'haze']);
    void cine.look({ fov: fovS, radial: 0, tint: 0x9a92da, desat: 0.45, vignette: 0.72 }, 0.05);
    ultSfx.thump(0.55);
    playOr(suckUrl, () => synth.noise({ type: 'lowpass', f0: 180, f1: 2200, dur: FORM + SIG, gain: 0.35, attack: (FORM + SIG) * 0.85 }), { gain: 0.9, endIn: FORM + SIG });
    synth.tone({ type: 'sawtooth', f0: 40, f1: 120, dur: FORM + SIG, gain: 0.12, attack: (FORM + SIG) * 0.7 });
    synth.tone({ type: 'sine', f0: 1600, f1: 3600, dur: FORM + SIG, gain: 0.025, attack: (FORM + SIG) * 0.9 });
    // Nephe stands directly under the wheel: this shot can see the wound on its back oozing purple-red light
    sc.vfx.emit({ pos: woundAt(c), count: Math.round(16 * amt), color: [CRACK, CRACK_HI], speed: [0.3, 1.2], life: [0.4, 0.8], size: [0.04, 0.08], radius: h * 0.06, gravity: -0.8, drag: 1.5, intensity: 0.8 });
  }, [], T_FORM);
  tl.to(sw, { form: 1, duration: FORM, ease: 'power1.inOut' }, T_FORM);
  tl.to(disc, { a: 1, duration: FORM + 0.2, ease: 'power1.in' }, T_FORM + 0.1);
  tl.to(sw, { wheelSpin: 1.1, spin: 2.4, duration: FORM, ease: 'power1.in' }, T_FORM);
  camTo(c, tl, T_FORM + 0.01, FORM + SIG, 'power1.inOut', () => [sigPos.clone().lerp(sigLook, 0.06), sigLook.clone().add(v3(0, h * 0.1, 0))]);

  // ⑧ Wheel formed: a ring of shockwave at the rim, spinning faster and faster, arcs leaping between the shadow orbs, the core brightening to the fullest
  tl.call(() => {
    ultSfx.thump(0.75);
    sc.rig.addTrauma(0.35);
    sc.stage.screenFlash(PINK_HI, sc.stage.quality === 'low' ? 0.1 : 0.18, 7);
    void sc.vfx.ring(wc, CRACK_HI, L.rho0, rho1 * 1.35, 0.55, L.wn, 1.6);
    void sc.vfx.ring(wc, 0xb070ff, L.rho0 * 0.5, rho1 * 0.9, 0.7, L.wn, 1.2);
    cine.shock(wc, 0.7, 0.5, 0.8);
    void cine.look({ tint: 0x928ad2, desat: 0.5, radial: 0.15, bloom: 0.9 }, SIG, ease.inQuad);
  }, [], T_SIG);
  tl.to(sw, { wheelSpin: 4.2, heat: 1.7, duration: SIG, ease: 'power2.in' }, T_SIG);
  tl.to(A, { glow: 1, duration: 0.2 }, T_SIG);
  const arcs = Math.round(12 * amt);
  for (let i = 0; i < arcs; i++) {
    tl.call(() => {
      const on = sw.orbs.filter((o) => o.state === 1);
      if (on.length < 2) return;
      const a = on[Math.floor(Math.random() * on.length)];
      let b = on[0];
      let best = Infinity;
      for (const o of on) {
        const d = o.pos.distanceTo(a.pos);
        if (o !== a && d > h * 0.3 && d < best) {
          best = d;
          b = o;
        }
      }
      void sc.vfx.bolt(a.pos.clone(), b.pos.clone(), CRACK_HI, 0.12, h * 0.012);
      if (i % 3 === 0) synth.noise({ type: 'highpass', f0: 2500, f1: 6000, dur: 0.06, gain: 0.06 });
    }, [], T_SIG + 0.1 + (i * (SIG - 0.15)) / arcs);
  }
  tl.call(() => sc.rig.addTrauma(0.25), [], T_SIG + SIG * 0.6);

  // ⑨ Lock-on: the wheel stops abruptly, all the shadow orbs flash at once; an eye glint, one crisp sound
  tl.set(sw, { wheelSpin: 0, spin: 0 }, T_LOCK);
  tl.call(() => {
    sw.flareAll(2.2);
    eyeGlint(c, CRACK_HI, 1.4);
    synth.tone({ type: 'sine', f0: 36, dur: 0.3, gain: 0.4 });
    sc.rig.addTrauma(0.3);
    void cine.pulse({ fov: fovS * 0.92, radial: 0.4 }, { fov: fovS * 0.97, radial: 0 }, 0.3);
  }, [], T_LOCK);
  tl.set({}, {}, T_END);
  await playTimeline(tl);
}

/** Each shadow orb that hits: impact sound, small flash, sparks, the black hole swells, the opponent shudders (on the same frame the shadow orb disappears) */
let lastOrbSound = 0;
function orbHit(c: UltCtx, o: Orb, gain: number): void {
  const { sc } = c;
  const m = mem(c);
  const L = m.lay;
  if (!L) return;
  const p = o.p3;
  void sc.vfx.flash(p, CRACK_HI, L.hf * 0.35 + o.r * 3, 0.1);
  sc.vfx.emit({ pos: p, count: Math.max(2, Math.round(6 * fxAmt(c))), color: [CRACK_HI, 0xffffff], speed: [3, 8], dir: o.ax, spread: 0.9, life: [0.1, 0.22], size: [0.03, 0.06], drag: 3, intensity: 0.85 });
  if (m.hole) m.hole.kick = Math.min(0.35, m.hole.kick + 0.06);
  m.recoil?.kick(0.035);
  sc.rig.addTrauma(0.04);
  // Sound: one sound per orb (lighter, with different pitches); when too many surge in at the same instant, only one sound within 8 ms, so it does not smear into a lump
  const now = performance.now();
  if (now - lastOrbSound < 8) return;
  lastOrbSound = now;
  const pitch = 1.05 + Math.random() * 0.35;
  playOr(hitUrl, () => {
    synth.tone({ type: 'sine', f0: 190 * pitch, f1: 60, dur: 0.12, gain: 0.18 * gain });
    synth.noise({ type: 'bandpass', f0: 2200, f1: 600, q: 1.2, dur: 0.05, gain: 0.14 * gain });
  }, { gain: 0.32 * gain, rate: pitch });
  if (Math.random() < 0.35) crunch(1.05 + Math.random() * 0.3, 0.3 * gain);
}

/** Each wave of impact: hit-stop, shake, screen shockwave, flash, shockwave ring, sparks, black smoke, the opponent recoiling, impact sound; the black hole at the impact point swells */
function salvoHit(c: UltCtx, k: number): void {
  const { sc, cine, foe } = c;
  const m = mem(c);
  const L = m.lay;
  if (!L) return;
  const low = sc.stage.quality === 'low';
  const p = L.tgt;
  const cam = sc.stage.camera.position;
  const toCam = cam.clone().sub(p).normalize();
  sc.stage.hitStop(26 + 26 * k);
  sc.rig.addTrauma(0.14 + 0.16 * k);
  cine.shock(p, 0.3 + 0.3 * k, 0.3, 0.3 + 0.25 * k);
  void sc.vfx.flash(p, PINK_HI, Math.min(L.hf * (0.7 + 0.5 * k) + 0.4, cam.distanceTo(p) * (low ? 0.2 : 0.32)), 0.14);
  void sc.vfx.ring(p, CRACK_HI, 0.1, L.hf * (0.45 + 0.45 * k) + 0.35, 0.24, toCam, low ? 1 : 1.5);
  const back = L.fwd.clone().negate().addScaledVector(UP, 0.35).normalize();
  sc.vfx.emit({ pos: p, count: Math.round((16 + 12 * k) * fxAmt(c)), color: [CRACK_HI, 0xffffff, CRACK], speed: [4, 11], dir: back, spread: 1.1, life: [0.12, 0.3], size: [0.03, 0.07], sizeEnd: 0.1, drag: 3, intensity: 0.9 });
  sc.vfx.smoke({ pos: p, count: 3, color: [VOID, 0x2a1040], speed: [1, 2.5], life: [0.3, 0.5], size: [0.25, 0.45], sizeEnd: 1.4, drag: 2 });
  sc.slots[foe].creature?.setFlash(PINK_HI, 0.5 + 0.3 * k);
  m.recoil?.kick(0.14 + 0.12 * k);
  if (m.hole) m.hole.kick = 0.22 + 0.1 * k;
  playOr(hitUrl, () => {
    synth.tone({ type: 'sine', f0: 150, f1: 42, dur: 0.22, gain: 0.35 });
    synth.noise({ type: 'bandpass', f0: 1800, f1: 400, q: 1.2, dur: 0.08, gain: 0.25 });
  }, { gain: 0.5 + 0.35 * k, rate: 0.9 + Math.random() * 0.22 });
  if (Math.random() < 0.5) crunch(0.85 + Math.random() * 0.3, 0.5);
}

/** Barrage: the wheel fires one orb after another from the outside in, wave after wave slamming into the impact point; the target's view takes the opponent's ultimate; finally the inner ring fires together in a volley */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const L = m.lay;
  const sw = m.swarm;
  const bh = m.hole;
  if (!L || !sw || !bh) return;
  const { h, hf, tgt, fwd } = L;
  const A = act(c);
  const port = sc.portrait;
  const n = m.belly;
  const foeC = sc.center(foe);
  const foeW = sc.slots[foe].creature?.width ?? 1;
  const casterC = sc.center(side);
  m.swallowR = Math.max(hf * 0.55 + 0.3, foeW * 0.55 + 0.25);
  const has = m.has;
  const orbCol = has ? ELEMENT_BRIGHT[foeElement(c)] : 0x9a8aa8;
  const all = sw.waiting();
  const total = all.length;
  const nVol = Math.max(6, Math.round(total * 0.36));
  const stream = all.slice(0, Math.max(0, total - nVol));
  const vol = all.slice(total - nVol);
  // Time of each wave's impact: the first wave at 0.8 s, the interval shrinking from 0.12 to 0.05
  const S = Math.max(1, Math.min(14 + 2 * n, Math.floor(stream.length / 2)));
  const arrive: number[] = [];
  for (let k = 0, t = 0.8; k < S; k++) {
    arrive.push(t);
    t += 0.12 - 0.07 * (k / Math.max(1, S - 1));
  }
  const A_LAST = arrive[S - 1];
  const T_TV = 0.72;
  const T_WIDE = Math.max(T_TV + 0.45, A_LAST - 0.32);
  const T_VOL = T_WIDE + 0.14;
  const VFLY = 0.62;
  const VSTAG = 0.05;
  const FLY_END = T_VOL + VSTAG + VFLY;
  // Launch: within 0.05 to 0.7 s the whole wheel fires from the outside in (faster and faster); those fired first arrive first
  const SWEEP = 0.65;
  let arrived = 0;
  let lastSalvo = -1;
  const vHit = S;
  // Each one that hits has its own impact sound and sparks; the first of each wave is a heavy hit (hit-stop, shake, shockwave, the opponent recoiling)
  sw.onArrive = (o) => {
    arrived++;
    bh.r = L.massR * (0.3 + 0.7 * Math.cbrt(arrived / Math.max(1, total)));
    const first = o.salvo !== lastSalvo;
    lastSalvo = o.salvo;
    if (first && o.salvo < vHit) salvoHit(c, o.salvo / Math.max(1, S - 1));
    else orbHit(c, o, o.salvo < vHit ? 1 : 0.7);
    if (first && o.salvo >= vHit) {
      // Volley arrives: the black hole swells to its largest in one go (then the director plays the impact)
      bh.kick = 0.4;
      bh.heat = 2.6;
    }
  };
  m.recoil = makeRecoil(c);

  const tl = sc.gs.timeline('world');
  // Launch order: the outer ring fires first, and the orbs of each wave fly for different numbers of seconds, arriving together
  tl.call(() => {
    const inSalvo = new Array<number>(S).fill(0);
    stream.forEach((o, i) => {
      const q = i / Math.max(1, stream.length - 1);
      const k = Math.min(S - 1, Math.floor((i * S) / stream.length));
      const at = 0.05 + SWEEP * Math.pow(q, 0.75);
      // Within one wave, one after another 12 ms apart: a run of consecutive hits can be heard, rather than stacking into one sound
      const hit = arrive[k] + inSalvo[k]++ * 0.012;
      sw.launch(o, at, Math.max(0.35, hit - at), k);
    });
    sw.spin = 0.6;
    bh.suck = 45;
    bh.heat = 1.2;
    playOr(barrageUrl, () => sfx.whooshBig(), { gain: 0.85 });
    synth.tone({ type: 'sawtooth', f0: 60, f1: 130, dur: FLY_END, gain: 0.07, attack: 0.1 });
    synth.noise({ type: 'lowpass', f0: 300, f1: 1600, dur: FLY_END, gain: 0.18, attack: FLY_END * 0.8 });
    ultSfx.thump(0.5);
  }, [], 0);
  // Add another whoosh partway through the barrage (for a long barrage)
  if (A_LAST > 1.4) tl.call(() => playOr(barrageUrl, () => sfx.whoosh(), { gain: 0.6, rate: 1.12 }), [], A_LAST * 0.55);
  tl.to(A, { glow: 0.7, duration: 0.4 }, 0.1);

  // Camera ①: no cut, staying on the wheel's signature camera position: the shadow orbs surge from the wheel toward the camera and the opponent behind it, howling past on both sides of the camera; the camera is pushed back a little by the rush
  const sig = m.sig;
  if (sig) {
    tl.call(() => {
      cine.track(() => L.wc, ['vig', 'radial', 'haze']);
      void cine.look({ radial: 0.25, haze: 0 }, 0.1);
    }, [], 0);
    camTo(c, tl, 0.01, T_TV - 0.01, 'power2.out', (_k, p0, l0) => [p0.clone().add(p0.clone().sub(l0).setY(0).normalize().multiplyScalar(h * 0.35)), l0.clone()]);
  }
  // Camera ②: the target's view. In front of the opponent toward the audience side, speed lines aimed at the impact point, the shadow orbs closing into one point from the four edges of the frame
  const fovT = port ? 1.35 : 1.15;
  const fs = Math.max(hf, foeW * 0.8);
  const tvLook = tgt.clone().add(v3(0, hf * 0.06, 0));
  const dT = fitDist(c, fs * 2.6, fs * 3.5, fovT);
  const tvPos = (yaw: number, d: number) => cine.safe(cine.orbitPos(side, tvLook, yaw, d, hf * 0.05), tvLook);
  const tv0 = tvPos(146, dT);
  const tv1 = tvPos(136, dT * 0.88);
  tl.call(() => {
    cine.cut(tv0, tvLook);
    cine.track(() => tgt, ['vig', 'radial', 'haze']);
    void cine.look({ fov: fovT, radial: 0.1, lines: 0.2, linesColor: 0xffffff }, 0.05);
  }, [], T_TV);
  camTo(c, tl, T_TV + 0.01, T_WIDE - T_TV - 0.01, 'power1.inOut', () => [tv1, tvLook]);
  tl.call(() => ripOrb(c, orbCol, has ? 0.55 : 0.45), [], T_TV + 0.12);

  // Camera ③: side wide shot: Nephe, the remaining wheel and the opponent in one frame; the inner ring fires together in a volley
  const fovW = port ? 1.3 : 1.08;
  const midP = casterC.clone().lerp(foeC, 0.52);
  const top = L.wc.y + L.rho1 * 0.7;
  const wLook = midP.clone().setY(top * 0.45);
  const span = casterC.distanceTo(foeC);
  const dW = fitDist(c, top * 1.05, span * 1.35, fovW);
  const wPos = cine.safe(cine.orbitPos(side, wLook, 96, dW, -top * 0.12), wLook);
  tl.call(() => {
    cine.cut(wPos, wLook);
    cine.track(() => tgt, ['vig', 'radial']);
    void cine.look({ fov: fovW, lines: 0, radial: 0.1 }, 0.05);
  }, [], T_WIDE);
  camTo(c, tl, T_WIDE + 0.01, FLY_END - T_WIDE - 0.01, 'power1.in', () => [wPos.clone().lerp(tgt, 0.1), wLook.clone().lerp(tgt, 0.12)]);
  tl.call(() => {
    for (const o of vol) {
      const d = Math.random() * VSTAG;
      sw.launch(o, d, VFLY + VSTAG - d, vHit);
    }
    sw.flareAll(1.8);
    playOr(engulfUrl, () => {
      sfx.whooshBig();
      synth.noise({ type: 'lowpass', f0: 300, f1: 1800, dur: VFLY, gain: 0.3, attack: 0.1 });
    }, { gain: 0.95, peakIn: VFLY + VSTAG });
    synth.tone({ type: 'sine', f0: 48, f1: 30, dur: 0.6, gain: 0.4 });
    ultSfx.thump(0.6);
    sc.rig.addTrauma(0.3);
    void cine.pulse({ radial: 0.35 }, { radial: 0.12 }, 0.3);
  }, [], T_VOL);
  tl.to(A, { glow: 1, duration: 0.1 }, T_VOL);
  if (m.disc) tl.to(m.disc, { a: 0, duration: 0.35, ease: 'power2.in' }, T_VOL + 0.1);
  tl.to(bh, { heat: 2, duration: FLY_END, ease: 'power2.in' }, 0);
  tl.set({}, {}, FLY_END);
  await playTimeline(tl);
  sw.onArrive = null;
  m.recoil.stop();
}

/** Taking the ultimate: a light orb in the opponent's element color is pulled out of its chest and swallowed into the black hole at the impact point (when there is no ultimate to take, it is a small lump of grey residue) */
function ripOrb(c: UltCtx, color: number, dur: number): void {
  const { sc, foe } = c;
  const m = mem(c);
  const bh = m.hole;
  if (!bh) return;
  const has = m.has;
  const hf = heightOf(c, foe);
  const foeC = sc.center(foe);
  const tex = glowTex();
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(has ? 1.3 : 0.7), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0xffffff).multiplyScalar(has ? 1 : 0.5), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  orb.add(core);
  core.scale.setScalar(0.4);
  orb.renderOrder = 45;
  const size = has ? hf * 0.34 + 0.3 : hf * 0.14 + 0.12;
  const out = foeC.clone().lerp(bh.pos, 0.4).add(v3(0, hf * 0.5, 0));
  const cr = sc.slots[foe].creature;
  cr?.setFlash(color, has ? 0.5 : 0.2);
  sc.rig.addTrauma(has ? 0.3 : 0.12);
  // Pulled out: a tearing sound; when there is an ultimate, an extra clear high note
  const tear: SampleVoice | null = playOr(ripUrl, () => {
    synth.noise({ type: 'highpass', f0: 700, f1: 3200, dur: 0.28, gain: has ? 0.3 : 0.15 });
    synth.tone({ type: 'sawtooth', f0: 320, f1: 900, dur: 0.28, gain: has ? 0.07 : 0.03 });
  }, { gain: has ? 0.75 : 0.35 });
  if (has) {
    synth.tone({ type: 'triangle', f0: 1320, f1: 1980, dur: 0.3, gain: 0.05, delay: 0.05 });
    c.cine.shock(foeC, 0.6, 0.35, 0.5);
    for (let i = 0; i < 3; i++) void sc.vfx.streak(foeC.clone().add(v3((Math.random() - 0.5) * hf * 0.5, (Math.random() - 0.3) * hf * 0.5, (Math.random() - 0.5) * hf * 0.5)), out, color, 0.05, hf * 0.5, 0.2);
  } else c.ui.float('蝕去', sc.top(foe), 'fl-weak');
  const p = new THREE.Vector3();
  let gulped = false;
  void sc.vfx.spawn(orb, dur, (k) => {
    // For the first 35% it is pulled out of the chest, shaking; afterwards it is sucked into the black hole
    if (k < 0.35) {
      const e = ease.outCubic(k / 0.35);
      p.lerpVectors(foeC, out, e);
      orb.scale.setScalar(size * Math.min(1, e * 1.6) * (1 + Math.sin(k * 60) * 0.06));
    } else {
      const e = ease.inCubic((k - 0.35) / 0.65);
      p.lerpVectors(out, bh.pos, e);
      orb.scale.setScalar(size * (1 - e * 0.75));
    }
    orb.position.copy(p);
    if (cr && k < 0.35) cr.setFlash(color, (has ? 0.5 : 0.2) * (1 - k / 0.35));
    if (k > 0.97 && !gulped) {
      gulped = true;
      tear?.fade(0.1);
      gulpSfx(has);
      crunch(0.8, 1.1);
      void sc.vfx.ring(bh.pos, has ? color : CRACK, bh.r * 0.8, bh.r * 2.6, 0.3, sc.stage.camera.position.clone().sub(bh.pos));
      sc.vfx.emit({ pos: bh.pos, count: Math.round((has ? 24 : 8) * fxAmt(c)), color: [color, CRACK_HI], speed: [1, 3], life: [0.25, 0.5], size: [0.04, 0.09], radius: bh.r, drag: 2, intensity: 0.9 });
      if (has) {
        bh.kick = 0.45;
        sc.rig.addTrauma(0.35);
      }
    }
  });
  if (has) sc.vfx.emit({ pos: foeC, count: Math.round(28 * fxAmt(c)), color: [color, 0xffffff], speed: [0.5, 2.5], inward: true, life: [0.2, 0.4], size: [0.05, 0.1], intensity: 0.9 });
}

/** Impact: the black hole pounces on the opponent and swallows it whole, contracts to a point, then bursts open and spits the opponent back out; Nephe closes its shell */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe, side } = c;
  const m = mem(c);
  const bh = m.hole;
  const hf = heightOf(c, foe);
  const foeC = sc.center(foe);
  const home = sc.slots[foe].home.clone();
  const cr = sc.slots[foe].creature;
  if (ev.hitIndex < ev.hits) {
    crunch(0.9, 0.8);
    return;
  }
  m.recoil?.stop();
  const holes = m.holes;
  // The impact is not a white flash but a black flash: the frame is swallowed by nothingness for two or three frames (this hook runs after the director's white flash, so it can cover it)
  sc.stage.screenFlash(0x02000a, 1, 7);
  crunch(0.6, 1.4);
  sc.rig.addTrauma(0.6);
  if (holes) holes.surge = 2.2;
  const tok = ++m.swallowTok;
  const tl = sc.gs.timeline('fx');
  if (bh) {
    const at = bh.pos.clone();
    const st = { k: 0 };
    // It comes down over the whole opponent and swells, covering it; a few bites are taken out of the surrounding world
    tl.to(st, { k: 1, duration: 0.1, ease: 'power3.out', onUpdate: () => bh.pos.lerpVectors(at, foeC, st.k) }, 0);
    tl.to(bh, { r: m.swallowR, heat: 2.6, ring: 0.8, duration: 0.1, ease: 'power3.out' }, 0);
    tl.call(() => {
      if (m.swallowTok === tok) cr?.setOpacity(0);
      bh.suck = 140;
      bh.inflow = 30;
      if (holes) {
        holes.safe.r = 0;
        biteAround(c, foeC, 5, hf * 1.6, [0.1, 0.2], 0.05);
      }
    }, [], 0.06);
    // Contracts to a point (implosion)
    tl.call(() => playOr(implodeUrl, () => synth.tone({ type: 'sine', f0: 200, f1: 36, dur: 0.5, gain: 0.35 }), { gain: 0.95 }), [], 0.1);
    tl.to(bh, { r: 0, duration: 0.2, ease: 'power3.in' }, 0.16);
    tl.to(bh, { heat: 3.5, duration: 0.2, ease: 'power2.in' }, 0.16);
    tl.call(() => {
      bh.suck = 0;
      bh.inflow = 0;
    }, [], 0.34);
  }
  // Spat back out: a purple-red shockwave ring, black smoke, obsidian fragments, ground cracks; the opponent reappears
  tl.call(() => {
    if (m.swallowTok === tok && cr) {
      cr.setOpacity(1);
      cr.setFlash(CRACK_HI, 0.8);
    }
    sfx.impactBig();
    ultSfx.thump(0.9);
    playOr(hitUrl, () => {}, { gain: 1, rate: 0.7 });
    synth.noise({ type: 'bandpass', f0: 3000, f1: 800, q: 1.2, dur: 0.6, gain: 0.12, delay: 0.05 });
    // Low quality has no tone mapping, so stacked light would wash out the whole frame directly: the flash is reduced, and the size of the blast is also tied to the camera distance
    const low = sc.stage.quality === 'low';
    sc.stage.screenFlash(PINK_HI, low ? 0.08 : 0.15, 8);
    sc.rig.addTrauma(0.7);
    cine.shock(foeC, 1.4, 0.7, 1.3);
    void cine.pulse({ radial: 0.8, lift: 0x1a0630 }, { radial: 0, lift: 0x000000 }, 0.5);
    // Bursting open: a ball of purple-white light bursts from the point where the black hole collapsed, beams shooting in all directions
    void sc.vfx.flash(foeC, PINK_HI, Math.min(hf * 2.6 + 1, sc.stage.camera.position.distanceTo(foeC) * (low ? 0.22 : 0.4)), 0.35);
    void sc.vfx.dome(foeC, CRACK_HI, hf * 0.3, hf * 1.8 + 1.4, 0.5);
    beams(c, foeC, 16, hf * 2, hf * 0.12, 0.55);
    void sc.vfx.glint(foeC, PINK_HI, hf * 0.9, 0.5, 4);
    void sc.vfx.ring(home.clone().setY(0.1), CRACK_HI, 0.4, hf * 2.2 + 5, 0.7);
    void sc.vfx.ring(home.clone().setY(0.12), 0xb070ff, 0.3, hf * 1.4 + 3, 0.9);
    void sc.vfx.decal(home.clone().setY(0.05), crackTex(5), CRACK, hf * 1.3 + 3, 2, undefined, 1.1);
    const a = fxAmt(c);
    sc.vfx.smoke({ pos: foeC, count: Math.round(40 * a), color: [VOID, 0x2a1040], speed: [1.5, 4], life: [0.6, 1.1], size: [0.4, 0.9], sizeEnd: 0.1, radius: hf * 0.3, gravity: 0.6, drag: 1.5 });
    sc.vfx.emit({ pos: foeC, count: Math.round(80 * a), color: [CRACK, CRACK_HI, 0xffffff], speed: [3, 10], life: [0.4, 0.9], size: [0.05, 0.14], sizeEnd: 0.02, radius: hf * 0.25, gravity: -2, drag: 1.2, intensity: 1 });
    shards(c, foeC, 18, hf * 3.2 + 2, 0.07 + hf * 0.03, 1.4);
    if (holes) {
      void sc.tw.to(0.9, (k) => {
        holes.surge = 2.2 - 1.2 * ease.outCubic(Math.min(1, k * 2));
        holes.knit = ease.inOutQuad(Math.max(0, (k - 0.3) / 0.7));
      }, ease.linear, 'fx');
    }
    cine.track(() => sc.center(foe), ['vig', 'radial']);
    void cine.look({ desat: 0.25, tint: 0xd0c4ff, haze: 0, radial: 0, lines: 0, bloom: 0.6 }, 0.4);
  }, [], bh ? 0.36 : 0.05);
  // Nephe closes its shell: a slam
  const A = act(c);
  tl.to(A, { open: 0, duration: 0.16, ease: 'power4.in' }, 0.5);
  tl.to(A, { glow: 0.3, crown: 0.35, duration: 0.3 }, 0.5);
  tl.call(() => {
    crunch(0.55, 1.2);
    synth.tone({ type: 'sine', f0: 140, f1: 50, dur: 0.2, gain: 0.25 });
    legacyHeat(c, 0.3);
  }, [], 0.66);
  // Camera: the impact frames hold the original composition, then it retreats from the current position and rises a little; holds a beat, then back to the wide shot
  tl.call(() => {
    const r = sc.rig;
    const look = r.look.clone().lerp(sc.center(side), 0.15).add(v3(0, hf * 0.1, 0));
    const pos = look.clone().add(r.pos.clone().sub(r.look).multiplyScalar(1.2)).add(v3(0, hf * 0.3, 0));
    void cine.shot(pos, look, 0.8, ease.outCubic);
    void cine.look({ fov: sc.portrait ? 1.3 : 1.05 }, 0.8);
  }, [], 0.55);
  tl.call(() => settleVoid(c, 0.55), [], 0.95);
}

/** Wrap up the cinematic's post-processing; after holding for hold seconds the camera pulls back to the wide shot (the post-hit battle text is read in the wide shot) */
function settleVoid(c: UltCtx, hold: number): void {
  const { sc, cine } = c;
  void cine.look({ desat: 0.08, isolate: 0, tint: 0xe4ddff, lift: 0x000000, vignette: 0.5, grain: 0, lines: 0, radial: 0, haze: 0, roll: 0, bloom: sc.stage.bloomBase * 0.85 }, 0.5);
  void c.wait(hold).then(() => {
    cine.track(null);
    void sc.rig.reset(0.8);
    void cine.look({ fov: 1, roll: 0 }, 0.8);
  });
}

/** Blocked: the black hole hits the barrier and is pushed back, shrinking away; the shell plates close early, and Nephe squints and chokes out a puff of black fog */
async function guarded(c: UltCtx): Promise<void> {
  const { sc, side } = c;
  const m = mem(c);
  m.recoil?.stop();
  const bh = m.hole;
  const A = act(c);
  const tl = sc.gs.timeline('fx');
  if (bh) {
    const at = bh.pos.clone();
    const back = at.clone().lerp(sc.center(side), 0.3);
    const st = { k: 0 };
    tl.to(st, { k: 1, duration: 0.45, ease: 'power2.out', onUpdate: () => bh.pos.lerpVectors(at, back, st.k) }, 0);
    tl.to(bh, { r: 0, heat: 0.3, duration: 0.45, ease: 'power2.in' }, 0);
    tl.call(() => (bh.suck = 0), [], 0);
  }
  if (m.holes) {
    const holes = m.holes;
    tl.to(holes, { knit: 1, surge: 0.6, duration: 0.35, ease: 'power2.in' }, 0);
  }
  tl.call(() => synth.tone({ type: 'sawtooth', f0: 200, f1: 60, dur: 0.3, gain: 0.1 }), [], 0);
  tl.to(A, { open: 0, duration: 0.16, ease: 'power4.in' }, 0.3);
  tl.to(A, { glare: 0.3, squint: 1, duration: 0.15 }, 0.46);
  tl.call(() => {
    crunch(0.55, 1);
    sc.vfx.smoke({ pos: mouthAt(c), count: Math.round(18 * fxAmt(c)), color: [VOID, 0x2a1040], speed: [1, 2.5], dir: c.cine.forward(side), spread: 0.5, life: [0.5, 0.9], size: [0.3, 0.6], drag: 1.5 });
    synth.noise({ type: 'lowpass', f0: 800, f1: 200, dur: 0.25, gain: 0.2 });
  }, [], 0.5);
  await ultGuarded(c);
}

/** Afterglow: the crown turns back to its original place, the eye returns to curious, the core's light withdraws; the holes are stitched shut */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  m.swallowTok++;
  m.recoil?.stop();
  sc.slots[c.foe].creature?.setOpacity(1);
  for (const l of m.layers) l.kill();
  m.layers = [];
  m.swarm?.kill();
  m.swarm = undefined;
  m.disc?.kill();
  m.disc = undefined;
  const A = act(c);
  const bh = m.hole;
  const holes = m.holes;
  const tl = sc.gs.timeline('fx');
  if (bh) {
    tl.to(bh, { r: 0, duration: 0.2, ease: 'power2.in' }, 0);
    tl.call(() => {
      bh.kill();
      m.hole = undefined;
    }, [], 0.22);
  }
  tl.to(A, { open: 0, duration: 0.2, ease: 'power2.in' }, 0);
  tl.to(A, { crown: 0, glow: 0, duration: 0.6, ease: 'power2.out' }, 0);
  tl.to(A, { glare: 0, squint: 0, duration: 0.4, ease: 'power1.inOut' }, 0.15);
  if (holes) {
    tl.to(holes, { knit: 1, duration: 0.3, ease: 'power2.inOut' }, 0);
    tl.call(() => {
      holes.kill();
      m.holes = undefined;
    }, [], 0.32);
  }
  // Legacy model: the crown's spinner and the glowing parts are put back as they were
  const L = m.legacy;
  if (L) {
    if (L.spin) L.spin.speed = L.spin0;
    L.glows.forEach((g, i) => g.color.copy(L.orig[i]));
  }
  tl.set({}, {}, 0.6);
  await playTimeline(tl);
  for (const k of ['glare', 'crown', 'open', 'glow', 'collapse', 'squint']) if (k in A) A[k] = 0;
}

export default defineSsr({
  windup,
  deliver,
  impact,
  guarded,
  settle(c) {
    // After a miss or a block: the black hole shrinks away, the shell plates close, and the camera holds a beat and returns to the wide shot
    const m = mem(c);
    m.recoil?.stop();
    const tl = c.sc.gs.timeline('fx');
    if (m.hole) {
      m.hole.suck = 0;
      tl.to(m.hole, { r: 0, duration: 0.3, ease: 'power2.in' }, 0);
    }
    tl.to(act(c), { open: 0, duration: 0.2, ease: 'power3.in' }, 0);
    settleVoid(c, 0.5);
  },
  after,
});
