// Noxfang, the Endless Night: "Eclipse Fang"
//
// What this cinematic is about: the night-watch wolf raises its head and howls, summoning the moon into a blood-red eclipse, and the world sinks into endless night; in the dark only its red eyes and the hunt marks on the prey remain.
// It turns into two streaks of red light and pounces across the battlefield; the crescent on its forehead spreads over the prey into a giant pair of jaws, upper and lower, and bites down, just as it bit the throat of the Void a thousand years ago.
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed)
//   windup
//     0.00  Announcement: letterbox, night presses down, the music is pulled out, a heartbeat starts; camera at a low angle right in front of the face (audience side 26°), slowly pushing in
//     0.12  Eyes open: the eyelids lift all at once, the pupils narrow (act.glare), red eye glints in both eyes, one "ching"
//     0.35  The crescent on its forehead flashes, the source crystal lights up (act.glow)
//     0.60  Moonrise: the camera pulls back and down and swings around to the side (26° → 100°, 0.9 s), a huge pale moon rises behind the wolf, the wolf's silhouette pressed against the moon
//     1.50  Howl (signature shot): head thrown back, mouth open (act.howl), the howl rippling outward in rings; the camera slowly pushes in, orbiting slightly to 114°;
//           the shadow of the eclipse slides across the moon's face and the moonlight turns blood red; at the total eclipse (2.60) a low rumble, a flash of red light, and a jolt of the screen
//     2.75  Hunt marks: cut to behind and above the wolf's shoulder (over-the-shoulder), looking at the prey across the field; the red claw marks on the prey light up one by one,
//           the kill line at its waist appears, then jumps up to double; the wolf in the foreground lowers its head and crouches (act.crouch), baring its teeth slightly, with a trace of red eyeshine left on the silhouette; the camera slowly pushes toward the prey
//     3.35  Endless Night: cut to a front-facing low-angle face close-up, the whole world sinks into darkness, leaving only a pair of red eyes; the heartbeat stops, and a low growl comes from the throat
//     3.85  End (the red eyes linger in the dark for half a second)
//   deliver (0.50 s: the length of the timeline is the time it takes the giant jaws to close)
//     0.00  Pounce: the darkness recedes, the wolf leaps up from its crouch (act.leap), the eyes trailing two streaks of red light, leaving dark purple afterimages and shadow smoke along the way;
//           the camera tracks alongside the wolf at audience side 86°, speed lines, radial blur
//     0.06  Eclipse Fang takes shape: a pool of shadow spreads at the prey's feet, with a moon-white crescent above and below (the shape of the crescent on its forehead, the lower jaw rising from the shadow), a row of white teeth along the inner edge, outlined in red light
//     0.15  Mouth opens (act.jaw)
//     0.32  Cut to the target's view: the camera on the prey's audience side at a low angle looking back at the wolf pouncing in, the blood moon hanging in the sky behind the wolf
//     0.44  The two crescents snap shut
//     0.50  The moment before impact (handed to the director to play the impact)
//   impact: the giant jaws close into a ring (the ring of the eclipse), the wolf biting down on the prey; red flash, shockwave, hit-stop, and the huge crunch of a bite;
//           0.3 s later the jaws shatter into fragments all over the ground and the wolf lands; the camera pulls back and up from the target's view,
//           and when the hunt kill holds (life after the hit ≤ twice the kill line), the jaws bite a second time along a diagonal, "Hunt Kill!"; then it pulls back to the wide shot
//   guarded: the jaws bite on the barrier and crumble, and the wolf is bounced back
//   after: the wolf drops its pose, the blood moon sinks and the hunt marks go out
//
// Model dependencies: only anchors (head, eyes, mouth, brand, crystal, crystalTip) and action weights (glare, howl, crouch, leap, jaw, glow) are used;
// the legacy model has no anchors or weights, so positions fall back to sc.head / sc.eyes, and writing the weights has no effect, but the cinematic still holds.

import * as THREE from 'three';
import { playOr, playSample, preloadSamples, type SampleVoice } from '../../../audio/samples.ts';
import { synth } from '../../../audio/sfx.ts';
import biteUrl from '../../../audio/sfx/noxfang-bite.mp3';
import eclipseUrl from '../../../audio/sfx/noxfang-eclipse.mp3';
import growlUrl from '../../../audio/sfx/noxfang-growl.mp3';
import howlUrl from '../../../audio/sfx/noxfang-howl.mp3';
import lungeUrl from '../../../audio/sfx/noxfang-lunge.mp3';
import shatterUrl from '../../../audio/sfx/noxfang-shatter.mp3';
import { playGrowl, playHowl, warmWolf } from '../../../audio/wolf.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { sceneMaterial } from '../../../render/spiritToon.ts';
import { glowTex } from '../../../render/textures.ts';
import { ease } from '../../../render/tween.ts';
import { additive, type FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [howlUrl, growlUrl, biteUrl, lungeUrl, eclipseUrl, shatterUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready (if the wolf howl and growl cannot be fetched, wolf.ts computes a synthesized fallback)
preloadSamples(...FILES);
warmWolf();

const RED = 0xff2a4a;
const BLOOD = 0xb0102a;
const RED_HI = 0xff8a9a;
const MOON = 0xd8d0f0;
const NIGHT = 0x8c92d8;
const VIOLET = 0x8a5aff;
const JAW_LT = 0xd4c8ff;
const BONE = 0xf2eaff;
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};

// ───────────────────────── State ─────────────────────────

interface Hunt {
  /** Hunt Mark stacks */
  marks: number;
  /** Kill line (%), before the ultimate */
  line: number;
  /** The ultimate's kill line (x2) */
  ultLine: number;
  /** The opponent's current life (%) */
  hp: number;
}

interface Mem {
  hunt: Hunt;
  moon?: Moon;
  marks?: Marks;
  plate?: Plate;
  jaws?: Jaws;
  eyes?: EyeFx;
  pool?: Pool;
  beat?: FxLayer;
  beatRate: number;
  howl?: SampleVoice | null;
  /** Path of the pounce (computed in deliver, then used by impact and guarded) */
  path?: { from: THREE.Vector3; to: THREE.Vector3; apex: THREE.Vector3 };
  /** Camera position of the target's view */
  tv?: { pos: THREE.Vector3; look: THREE.Vector3 };
  hunted?: boolean;
  layers: FxLayer[];
}

function readHunt(c: UltCtx): Hunt {
  const me = c.view.sides[c.side];
  const mk = me.team[me.active]?.marks.find((m) => m.id === 'kit:hunt');
  const marks = Math.max(0, Math.min(5, mk?.n ?? 0));
  const line = Number(/斬殺線 (\d+)%/.exec(mk?.note ?? '')?.[1] ?? (marks * 6 + (c.view.field?.element === 'dark' ? 10 : 0)));
  const fv = c.view.sides[c.foe];
  const f = fv.team[fv.active];
  const hp = f && f.maxHp > 0 ? (f.hp / f.maxHp) * 100 : 100;
  return { marks, line, ultLine: line * 2, hp };
}

const mem = (c: UltCtx): Mem => (c.mem.nox ??= { hunt: readHunt(c), beatRate: 0.75, layers: [] }) as Mem;

/** The wolf's action weights (only effective on the new model) */
const act = (c: UltCtx): Record<string, number> => c.sc.slots[c.side].creature?.act ?? {};

/** World position of a caster anchor; use fallback when the legacy model has no such anchor */
function anchorPos(c: UltCtx, name: string, fallback: () => THREE.Vector3): THREE.Vector3 {
  const cr = c.sc.slots[c.side].creature;
  const a = cr?.anchor(name);
  if (!cr || !a) return fallback();
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}

/** Midpoint of the two eyes */
function eyesMid(c: UltCtx): THREE.Vector3 {
  const es = c.sc.eyes(c.side);
  if (!es.length) return c.sc.head(c.side);
  return es.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / es.length);
}

/** How far away to frame a region of height hgt and width wid completely (by the current field-of-view multiplier and aspect ratio) */
function fitDist(c: UltCtx, hgt: number, wid: number, fovScale = 1): number {
  const { sc } = c;
  const cam = sc.stage.camera;
  const halfTan = Math.tan(THREE.MathUtils.degToRad((cam.fov / sc.stage.fovScale) * fovScale * 0.5));
  return Math.max((hgt * 0.5) / halfTan, (wid * 0.5) / (halfTan * cam.aspect));
}

/** Amount of VFX: 1 on high quality, 0.7 on medium, 0.4 on low */
function density(c: UltCtx): number {
  const q = c.sc.stage.quality;
  return q === 'low' ? 0.4 : q === 'medium' ? 0.7 : 1;
}

/** Move the camera along fn(k) for a while (fx clock); stops if another camera move takes over */
function camPath(c: UltCtx, dur: number, fn: (k: number) => [THREE.Vector3, THREE.Vector3], e: (x: number) => number = ease.inOutQuad): Promise<void> {
  const r = c.sc.rig;
  const tok = r.claim();
  return c.sc.tw.to(dur, (k) => {
    if (!r.owns(tok)) return;
    const [p, l] = fn(k);
    r.pos.copy(p);
    r.look.copy(l);
  }, e, 'fx');
}

// ───────────────────────── Textures ─────────────────────────

let clawTex: THREE.CanvasTexture | null = null;
/** Three curved claw marks (red, with a glow) */
function clawTexture(): THREE.CanvasTexture {
  if (clawTex) return clawTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);
  g.lineCap = 'round';
  for (const pass of [0, 1]) {
    g.shadowBlur = pass ? 0 : 14;
    g.shadowColor = 'rgba(255,60,90,0.9)';
    g.strokeStyle = pass ? 'rgba(255,235,240,0.95)' : 'rgba(255,40,70,0.9)';
    for (let i = 0; i < 3; i++) {
      const x0 = 30 + i * 24;
      g.lineWidth = pass ? 2.2 : 5.5;
      g.beginPath();
      g.moveTo(x0 + 10, 18 + i * 4);
      g.bezierCurveTo(x0 - 6, 50, x0 - 8, 80, x0 + 4, 112 - i * 6);
      g.stroke();
    }
  }
  clawTex = new THREE.CanvasTexture(cv);
  clawTex.colorSpace = THREE.SRGBColorSpace;
  return clawTex;
}

let softTex: THREE.CanvasTexture | null = null;
/** A soft-edged circle (for shadows) */
function softTexture(): THREE.CanvasTexture {
  if (softTex) return softTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.85)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  softTex = new THREE.CanvasTexture(cv);
  return softTex;
}

// ───────────────────────── Moon ─────────────────────────

interface Moon {
  place(pos: THREE.Vector3, radius: number): void;
  set(ecl: number, alpha: number): void;
  kill(): void;
}

/** A moon that always faces the camera: a pale moon face with a glow; uEcl 0→1 the shadow slides in from the side and the moonlight turns blood red, leaving only a red rim at total eclipse */
function makeMoon(c: UltCtx): Moon {
  const { sc } = c;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(MOON) }, uRed: { value: new THREE.Color(RED).multiplyScalar(1.4) }, uEcl: { value: 0 }, uA: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uRed; uniform float uEcl; uniform float uA; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float disc = smoothstep(0.5, 0.485, r);
        // Dark patches on the lunar surface
        float cr = 0.16 * smoothstep(0.17, 0.04, length(p - vec2(0.16, 0.12)));
        cr += 0.13 * smoothstep(0.13, 0.03, length(p - vec2(-0.2, -0.06)));
        cr += 0.1 * smoothstep(0.1, 0.02, length(p - vec2(0.04, -0.29)));
        cr += 0.08 * smoothstep(0.09, 0.02, length(p - vec2(-0.09, 0.3)));
        float mot = 0.92 + 0.08 * sin(p.x * 23.0 + sin(p.y * 17.0) * 2.0) * sin(p.y * 19.0 + p.x * 7.0);
        float k = smoothstep(0.3, 0.95, uEcl);
        vec3 base = uCol * (1.0 - cr) * 0.95 * mot;
        vec3 blood = uRed * (0.14 + 0.24 * (1.0 - cr)) * mot;
        vec3 mcol = mix(base, blood, k);
        // The shadow (umbra) slides in from the right
        vec2 sc = vec2(mix(1.3, 0.0, uEcl), 0.05);
        float ds = length(p - sc);
        float sh = smoothstep(0.515, 0.49, ds);
        vec3 lit = mix(mcol, blood * 0.45, sh) * mix(1.0, 0.7 + 0.5 * smoothstep(-0.5, 0.5, p.x), k);
        // A ring of red light along the shadow edge, brighter the closer to a total eclipse
        float rim = exp(-abs(ds - 0.5) * 30.0) * disc * smoothstep(0.15, 0.6, uEcl);
        vec3 col = lit * disc + uRed * rim * (0.9 + 1.3 * k);
        float halo = exp(-(r - 0.5) * 5.5) * step(0.5, r);
        vec3 hcol = mix(uCol, uRed * 0.9, k) * halo * 0.5;
        float alpha = clamp(disc + halo * 0.55, 0.0, 1.0) * uA;
        gl_FragColor = vec4(col + hcol, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.renderOrder = 4;
  let radius = 1;
  const layer = sc.vfx.layer(m, () => {
    m.quaternion.copy(sc.stage.camera.quaternion);
    m.scale.setScalar(radius * 2);
  });
  return {
    place(pos, r) {
      m.position.copy(pos);
      radius = r;
    },
    set(ecl, alpha) {
      mat.uniforms.uEcl.value = ecl;
      mat.uniforms.uA.value = alpha;
    },
    kill: () => layer.kill(),
  };
}

/** The moon hangs far off in the camera's look direction: it appears up radii above the center of the frame, and its size is about frac of the frame height */
function moonAlong(c: UltCtx, cam: THREE.Vector3, look: THREE.Vector3, far: number, frac: number, up: number): { pos: THREE.Vector3; r: number } {
  const { sc } = c;
  const dir = look.clone().sub(cam).normalize();
  const dist = cam.distanceTo(look) + far;
  const halfTan = Math.tan(THREE.MathUtils.degToRad((sc.stage.camera.fov / sc.stage.fovScale) * 0.5));
  const r = halfTan * dist * frac;
  return { pos: cam.clone().addScaledVector(dir, dist).addScaledVector(UP, r * up), r };
}

// ───────────────────────── Hunt marks and kill line ─────────────────────────

interface Marks {
  ignite(i: number): void;
  pulse(k: number): void;
  setLine(pct: number): void;
  setHp(pct: number): void;
  flare(amt: number): void;
  fade(k: number): void;
  /** Make the ring visible while the shaders are being precompiled */
  warm(on: boolean): void;
  kill(): void;
}

/** Red claw marks on the prey (stack count = hunt marks), the red ring at the waist = the kill line, the faint ring = current life; all drawn on the top layer so the body cannot hide them */
function makeMarks(c: UltCtx): Marks {
  const { sc, foe } = c;
  const cr = sc.slots[foe].creature;
  const hf = cr?.worldHeight ?? 1.5;
  const home = sc.slots[foe].home.clone();
  const root = new THREE.Group();
  const n = mem(c).hunt.marks;
  const claws: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; on: number; base: number; rot: number }[] = [];
  const tex = clawTexture();
  for (let i = 0; i < n; i++) {
    const mat = additive(RED, tex, 0);
    mat.depthTest = false;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.renderOrder = 20;
    const a = i * 2.4 + 0.7;
    const rr = hf * (0.12 + (i % 3) * 0.07);
    m.position.set(Math.cos(a) * rr, hf * (0.32 + ((i * 0.37) % 1) * 0.42), Math.sin(a) * rr);
    const base = hf * (0.24 + (i % 2) * 0.05);
    root.add(m);
    claws.push({ m, mat, on: 0, base, rot: (i % 2 ? 1 : -1) * (0.3 + i * 0.17) });
  }
  const ringR = Math.max(hf * 0.42, (cr?.width ?? 1) * 0.62);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.014, 6, 64), additive(RED, undefined, 1.1));
  const ringHalo = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.05, 6, 64), additive(BLOOD, undefined, 0.25));
  const hpRing = new THREE.Mesh(new THREE.TorusGeometry(ringR * 1.02, 0.008, 6, 64), additive(MOON, undefined, 0.8));
  for (const r of [ring, ringHalo, hpRing]) {
    r.rotation.x = Math.PI / 2;
    (r.material as THREE.Material).depthTest = false;
    r.renderOrder = 21;
    r.visible = false;
    root.add(r);
  }
  const lineY = (pct: number) => hf * Math.min(1.08, Math.max(0.02, pct / 100));
  let flare = 0;
  let pulse = 1;
  let alpha = 1;
  const layer = sc.vfx.layer(root, (dt, t) => {
    root.position.copy(cr ? cr.root.position : home);
    const q = sc.stage.camera.quaternion;
    flare = Math.max(0, flare - dt * 3);
    for (const cl of claws) {
      cl.m.quaternion.copy(q);
      cl.m.rotateZ(cl.rot);
      const flick = 0.85 + 0.15 * Math.sin(t * 23 + cl.rot * 9);
      cl.m.scale.setScalar(cl.base * (1 + flare * 0.25));
      cl.mat.color.set(RED).multiplyScalar(cl.on * (1.1 + flare * 1.2) * flick * pulse * alpha);
    }
    (ring.material as THREE.MeshBasicMaterial).color.set(RED).multiplyScalar((1.1 + flare * 1.2) * pulse * alpha);
    (ringHalo.material as THREE.MeshBasicMaterial).color.set(BLOOD).multiplyScalar((0.25 + flare * 0.5) * pulse * alpha);
    (hpRing.material as THREE.MeshBasicMaterial).color.set(MOON).multiplyScalar(0.8 * alpha);
  });
  return {
    ignite(i) {
      const cl = claws[i];
      if (!cl) return;
      cl.on = 1;
      flare = Math.max(flare, 0.7);
      const p = cl.m.getWorldPosition(new THREE.Vector3());
      sc.vfx.emit({ pos: p, count: Math.round(10 * density(c)), color: [RED, RED_HI], speed: [0.4, 1.2], life: [0.2, 0.4], size: [0.03, 0.07], sizeEnd: 0.01, radius: 0.1, intensity: 0.7 });
    },
    pulse(k) {
      pulse = k;
    },
    setLine(pct) {
      const y = lineY(pct);
      ring.visible = ringHalo.visible = pct > 0;
      ring.position.y = ringHalo.position.y = y;
    },
    setHp(pct) {
      hpRing.visible = true;
      hpRing.position.y = lineY(pct);
    },
    flare(amt) {
      flare = Math.max(flare, amt);
    },
    fade(k) {
      alpha = k;
    },
    warm(on) {
      for (const r of [ring, ringHalo, hpRing]) r.visible = on;
    },
    kill: () => layer.kill(),
  };
}

// ───────────────────────── Endless Night (the black screen in front of the view) ─────────────────────────

interface Plate {
  set(a: number): void;
  /** Make it visible while the shaders are being precompiled (hidden objects are not compiled) */
  warm(on: boolean): void;
  kill(): void;
}

/**
 * A sheet of black pasted in front of the camera: the whole world sinks into darkness. Drawn before the red eyes and red light trails (renderOrder 11),
 * so only the eyes remain in the dark; the four corners are a little darker than the center, and the wolf's outline can still be faintly seen.
 */
function makePlate(c: UltCtx): Plate {
  const { sc } = c;
  const cam = sc.stage.camera;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uA; uniform float uAspect; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float r = length(p);
        float a = uA * mix(0.9, 1.0, smoothstep(0.15, 0.7, r));
        gl_FragColor = vec4(0.012, 0.0, 0.02, a);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.renderOrder = 11;
  m.frustumCulled = false;
  m.visible = false;
  const layer = sc.vfx.layer(m, () => {});
  const dir = new THREE.Vector3();
  // Attached only after the camera updates (so shake and roll are followed)
  const off = sc.stage.add(() => {
    const D = 0.6;
    cam.getWorldDirection(dir);
    m.position.copy(cam.position).addScaledVector(dir, D);
    m.quaternion.copy(cam.quaternion);
    const h = 2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 1.35;
    m.scale.set(h * cam.aspect, h, 1);
    mat.uniforms.uAspect.value = cam.aspect;
  });
  return {
    set(a) {
      mat.uniforms.uA.value = a;
      m.visible = a > 0.001;
    },
    warm(on) {
      m.visible = on;
    },
    kill() {
      off();
      layer.kill();
    },
  };
}

// ───────────────────────── Red eyes and red light trails ─────────────────────────

interface EyeFx {
  /** Glow of the eyes (the pair of eyes visible in the dark) */
  glow: number;
  /** Trail: when true, the eyes' positions are recorded every frame, dragging out red light */
  trail: boolean;
  kill(): void;
}

/** The glow of a pair of red eyes and the red light trails dragging behind (drawn above the black screen); positions are read from the eye anchors every frame */
function makeEyeFx(c: UltCtx): EyeFx {
  const { sc } = c;
  const N = 26;
  const root = new THREE.Group();
  root.renderOrder = 13;
  const fx: EyeFx = { glow: 0, trail: false, kill: () => layer.kill() };
  const eyes = () => {
    const es = sc.eyes(c.side);
    return es.length >= 2 ? es.slice(0, 2) : [sc.head(c.side), sc.head(c.side)];
  };
  const halos = [0, 1].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(RED).multiplyScalar(2.2), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.renderOrder = 13;
    root.add(s);
    return s;
  });
  const cores = [0, 1].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xffd0d8).multiplyScalar(2.5), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.renderOrder = 14;
    root.add(s);
    return s;
  });
  // Trail: one camera-facing ribbon per eye, wide at the head and thin at the tail, bright at the head and dark at the tail (additive blending, the darker the color the more transparent)
  const trails = [0, 1].map(() => {
    const pos = new Float32Array(N * 2 * 3);
    const col = new Float32Array(N * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 13;
    root.add(mesh);
    return { mesh, pos, col, pts: [] as THREE.Vector3[] };
  });
  const h = sc.slots[c.side].creature?.worldHeight ?? 1.5;
  const w0 = h * 0.014;
  const red = new THREE.Color(RED);
  const hot = new THREE.Color(0xffc0c8);
  const tmp = new THREE.Color();
  const toCam = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  let t = 0;
  const layer = sc.vfx.layer(root, (dt) => {
    t += dt;
    const es = eyes();
    const flick = 0.9 + 0.1 * Math.sin(t * 31);
    for (let i = 0; i < 2; i++) {
      halos[i].position.copy(es[i]);
      halos[i].scale.setScalar(h * 0.075 * fx.glow * flick);
      halos[i].material.opacity = Math.min(1, fx.glow);
      cores[i].position.copy(es[i]);
      cores[i].scale.setScalar(h * 0.022 * fx.glow);
      cores[i].material.opacity = Math.min(1, fx.glow);
      const tr = trails[i];
      if (fx.trail) {
        tr.pts.unshift(es[i].clone());
        if (tr.pts.length > N) tr.pts.pop();
      } else if (tr.pts.length) {
        // Stop recording: the tail draws in toward the head
        tr.pts.pop();
        if (tr.pts.length) tr.pts.pop();
      }
      const n = tr.pts.length;
      for (let j = 0; j < N; j++) {
        const p = tr.pts[Math.min(j, Math.max(0, n - 1))] ?? es[i];
        const q = tr.pts[Math.min(j + 1, Math.max(0, n - 1))] ?? p;
        tan.copy(p).sub(q);
        if (tan.lengthSq() < 1e-8) tan.set(0, 0, 1);
        toCam.copy(sc.stage.camera.position).sub(p);
        side.crossVectors(tan, toCam).normalize();
        const u = n > 1 ? Math.min(1, j / (n - 1)) : 1;
        const w = w0 * (1 - u * 0.85) * (j < n ? 1 : 0);
        tr.pos.set([p.x + side.x * w, p.y + side.y * w, p.z + side.z * w, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w], j * 6);
        tmp.copy(hot).lerp(red, Math.min(1, u * 2)).multiplyScalar(2.2 * Math.pow(1 - u, 1.4) * (j < n ? 1 : 0));
        tr.col.set([tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b], j * 6);
      }
      (tr.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (tr.mesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  });
  return fx;
}

// ───────────────────────── Shadow pool ─────────────────────────

interface Pool {
  set(r: number, a: number): void;
  kill(): void;
}

/** A pool of shadow spreading at the prey's feet (black, normal blending): the lower jaw rises from here */
function makePool(c: UltCtx): Pool {
  const { sc, foe } = c;
  const mat = new THREE.MeshBasicMaterial({ map: softTexture(), color: 0x000000, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  let r = 0.01;
  const layer = sc.vfx.layer(m, () => {
    const cr = sc.slots[foe].creature;
    m.position.copy(cr ? cr.root.position : sc.slots[foe].home).setY(0.05);
    m.scale.setScalar(Math.max(0.01, r));
  });
  return {
    set(rr, a) {
      r = rr;
      mat.opacity = a;
    },
    kill: () => layer.kill(),
  };
}

// ───────────────────────── Eclipse Fang (giant jaws) ─────────────────────────

interface Jaws {
  root: THREE.Group;
  /** Outer radius */
  S: number;
  /** show 0 to 1 takes shape; open 0 closed, 1 fully open; glow red light outline; roll rotates the whole set around the normal (the second bite goes along a diagonal) */
  k: { show: number; open: number; glow: number; roll: number; shake: number };
  /** Shatter: hide the jaws and burst a ground full of fragments in place */
  shatter(): void;
  kill(): void;
}

/** Outline of a crescent (points facing up): outer circle radius 1, inner circle radius r with its center up by d */
function crescentShape(r: number, d: number): { shape: THREE.Shape; tip: [number, number]; b: number } {
  const ty = (1 - r * r + d * d) / (2 * d);
  const tx = Math.sqrt(1 - ty * ty);
  const a = Math.atan2(ty, tx);
  const b = Math.atan2(ty - d, tx);
  const s = new THREE.Shape();
  s.absarc(0, 0, 1, a, Math.PI - a, true);
  s.absarc(0, d, r, Math.PI - b, b, false);
  return { shape: s, tip: [tx, ty], b };
}

/**
 * Eclipse Fang: a moon-white crescent above and below (the shape of the crescent on its forehead), a row of white teeth along the inner edge with the longest canines at the two ends, and a ring of red light behind.
 * The jaws are a solid object: scene material, with the outline layer on (lines thinner than the spirits'), while the red light is an additive VFX sprite.
 * The plane the jaws lie in faces normal (the target-view camera); when closed the two crescents lock into a ring, which is the red rim of the total eclipse.
 */
function makeJaws(c: UltCtx, S: number, normal: THREE.Vector3): Jaws {
  const { sc, foe } = c;
  const R_IN = 0.9;
  const D = 0.24;
  const { shape, tip, b } = crescentShape(R_IN, D);
  const depth = 0.26;
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 2, curveSegments: 40 });
  geo.translate(0, 0, -depth / 2);
  geo.scale(S, S, S);
  // The jaws are the crescent from its forehead: moon white with a touch of pale purple, faintly glowing on its own so it reads clearly in the dark; the teeth are bone white
  const body = sceneMaterial(JAW_LT, { rim: 0.5, emissive: 0x6a50c8, emissiveAmt: 0.26 });
  const tooth = sceneMaterial(BONE, { rim: 0.3, emissive: 0x802030, emissiveAmt: 0.15 });
  const haloGeo = new THREE.ShapeGeometry(shape, 40);
  haloGeo.scale(S * 1.12, S * 1.12, 1);
  const halos: THREE.MeshBasicMaterial[] = [];
  const toothGeo = new THREE.ConeGeometry(1, 1, 7);
  toothGeo.translate(0, 0.5, 0);
  const mkJaw = (flip: boolean) => {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    if (flip) inner.rotation.z = Math.PI;
    g.add(inner);
    const m = new THREE.Mesh(geo, body);
    inner.add(m);
    // Teeth: lined up along the inner edge, pointing toward the center of the inner circle; the canines near the two tips are the longest
    const n = 9;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const th = Math.PI - b + 0.2 + (Math.PI + 2 * b - 0.4) * u;
      const dir = v3(-Math.cos(th), -Math.sin(th), 0);
      const canine = i === 1 || i === n - 2;
      const len = S * (canine ? 0.3 : 0.15 + 0.04 * Math.sin(u * Math.PI));
      const rad = S * (canine ? 0.055 : 0.04);
      const t = new THREE.Mesh(toothGeo, tooth);
      t.position.set(Math.cos(th) * R_IN * S, (D + Math.sin(th) * R_IN) * S, 0).addScaledVector(dir, -len * 0.12);
      t.quaternion.setFromUnitVectors(UP, dir);
      t.scale.set(rad, len, rad);
      inner.add(t);
    }
    const hm = additive(RED, undefined, 1.4);
    hm.opacity = 0;
    halos.push(hm);
    const halo = new THREE.Mesh(haloGeo, hm);
    halo.position.z = -S * 0.2;
    halo.renderOrder = 3;
    inner.add(halo);
    return { g, inner };
  };
  const { g: upper, inner: upperIn } = mkJaw(true);
  const { g: lower, inner: lowerIn } = mkJaw(false);
  const root = new THREE.Group();
  root.add(upper, lower);
  for (const g of [upper, lower])
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material !== halos[0] && m.material !== halos[1]) {
        m.layers.enable(INK_LAYER);
        m.userData.inkScene = true;
      }
    });
  registerInkRoot(root);
  // The plane faces normal (taking only the horizontal direction), with y up
  const z = normal.clone().setY(0).normalize();
  const x = new THREE.Vector3().crossVectors(UP, z).normalize();
  const basis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, UP, z));
  const k = { show: 0, open: 1, glow: 0, roll: 0, shake: 0 };
  const cr = sc.slots[foe].creature;
  const hf = cr?.worldHeight ?? 1.5;
  let t = 0;
  let broken = false;
  const layer = sc.vfx.layer(root, (dt) => {
    t += dt;
    root.position.copy(cr ? cr.root.position : sc.slots[foe].home).setY(hf * 0.5);
    root.quaternion.copy(basis);
    root.rotateZ(k.roll);
    const s = Math.max(0.001, k.show);
    root.scale.setScalar(0.35 + 0.65 * ease.outCubic(Math.min(1, s)));
    root.visible = !broken && k.show > 0.001;
    // When closed, the tips of the upper and lower crescents interlock (each center 0.16S away), and when open each pulls back to 1.05S
    const g = S * (0.16 + 0.7 * k.open);
    const jig = k.shake * S * 0.03 * Math.sin(t * 90);
    upper.position.set(jig, g, 0);
    lower.position.set(-jig, -g, 0);
    upper.rotation.z = -0.18 * k.open;
    lower.rotation.z = 0.12 * k.open;
    for (const hm of halos) hm.opacity = Math.min(1, k.glow) * Math.min(1, s * 1.5);
  }, () => {
    geo.dispose();
    haloGeo.dispose();
    toothGeo.dispose();
    body.dispose();
    tooth.dispose();
    for (const hm of halos) hm.dispose();
  });
  const jaws: Jaws = {
    root,
    S,
    k,
    shatter() {
      if (broken) return;
      broken = true;
      root.updateMatrixWorld(true);
      const pts: { p: THREE.Vector3; bone: boolean }[] = [];
      const d = density(c);
      const a = Math.atan2(tip[1], tip[0]);
      const ic = v3(0, D, 0);
      for (const [gi, g] of [upperIn, lowerIn].entries()) {
        const n = Math.round(22 * d);
        for (let i = 0; i < n; i++) {
          // Take points along the crescent's center line (tip to tip): the midpoint between a point on the outer circle and the nearest point on the inner circle
          const th = Math.PI - a + (Math.PI + 2 * a) * ((i + 0.5) / n);
          const outer = v3(Math.cos(th), Math.sin(th), 0);
          const inner = outer.clone().sub(ic).normalize().multiplyScalar(R_IN).add(ic);
          const lp = outer.add(inner).multiplyScalar(0.5 * S);
          lp.z = (hash(i + gi * 50) - 0.5) * depth * S;
          pts.push({ p: g.localToWorld(lp), bone: i % 4 === 1 });
        }
      }
      shards(c, pts, root.getWorldPosition(new THREE.Vector3()), S);
    },
    kill: () => layer.kill(),
  };
  return jaws;
}

/** Jaw fragments: moon-white chunks and bone-white tooth shards in scene material, bursting outward from the center of the bite, bouncing after they land, then shrinking and vanishing (outline layer on) */
function shards(c: UltCtx, pts: { p: THREE.Vector3; bone: boolean }[], center: THREE.Vector3, S: number): void {
  const { sc } = c;
  const g = new THREE.Group();
  const shell = sceneMaterial(JAW_LT, { rim: 0.5, emissive: 0x6a50c8, emissiveAmt: 0.26 });
  const bone = sceneMaterial(BONE, { rim: 0.3 });
  const geos = [new THREE.OctahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0)];
  const bits = pts.map(({ p, bone: b }, i) => {
    const m = new THREE.Mesh(geos[i % 2], b ? bone : shell);
    const sz = S * (b ? 0.05 : 0.07 + hash(i * 3.1) * 0.07);
    m.scale.set(sz, sz * (0.5 + hash(i * 7.3) * 0.6), sz * 0.45);
    m.position.copy(p);
    m.rotation.set(hash(i) * 6, hash(i * 2) * 6, hash(i * 5) * 6);
    m.layers.enable(INK_LAYER);
    m.userData.inkScene = true;
    g.add(m);
    const out = p.clone().sub(center);
    out.y = Math.max(out.y, 0) * 0.5;
    const vel = out.normalize().multiplyScalar(2.5 + hash(i * 9.1) * 4).add(v3(0, 2 + hash(i * 4.7) * 3, 0));
    return { m, vel, w: v3(hash(i * 1.3) - 0.5, hash(i * 2.7) - 0.5, hash(i * 3.9) - 0.5).multiplyScalar(18), s0: m.scale.clone() };
  });
  registerInkRoot(g);
  void sc.vfx.spawn(g, 1.5, (k, dt) => {
    for (const b of bits) {
      b.vel.y -= 16 * dt;
      b.m.position.addScaledVector(b.vel, dt);
      if (b.m.position.y < 0.06) {
        b.m.position.y = 0.06;
        b.vel.y = Math.abs(b.vel.y) * 0.3;
        b.vel.x *= 0.55;
        b.vel.z *= 0.55;
        b.w.multiplyScalar(0.5);
      }
      b.m.rotation.x += b.w.x * dt;
      b.m.rotation.y += b.w.y * dt;
      b.m.rotation.z += b.w.z * dt;
      const f = k > 0.6 ? Math.max(0.01, 1 - (k - 0.6) / 0.4) : 1;
      b.m.scale.copy(b.s0).multiplyScalar(f);
    }
  }, () => {
    for (const x of geos) x.dispose();
    shell.dispose();
    bone.dispose();
  });
  // The moment of shattering: shadow smoke and red sparks
  const d = density(c);
  sc.vfx.smoke({ pos: center, count: Math.round(40 * d), color: [0x14081e, 0x2e1446], speed: [1.5, 4], life: [0.5, 1], size: [0.3, 0.6], sizeEnd: 0.9, radius: S * 0.6, drag: 2 });
  sc.vfx.emit({ pos: center, count: Math.round(50 * d), color: [RED, BLOOD, RED_HI], speed: [3, 8], life: [0.25, 0.55], size: [0.04, 0.1], sizeEnd: 0.01, radius: S * 0.5, drag: 2, gravity: -5, intensity: 0.9 });
  playOr(shatterUrl, () => synth.noise({ type: 'highpass', f0: 3000, f1: 900, dur: 0.5, gain: 0.3 }), { gain: 0.55 });
}

// ───────────────────────── Heartbeat ─────────────────────────

/** Heartbeat: an ever-quickening low-frequency "thud-thud", the hunt marks pulsing along and the vignette tightening a little */
function startHeartbeat(c: UltCtx): void {
  const { sc, cine } = c;
  const m = mem(c);
  let next = 0.05;
  let t = 0;
  m.beat = sc.vfx.layer(new THREE.Object3D(), (dt) => {
    t += dt;
    if (t < next) return;
    next = t + m.beatRate;
    synth.tone({ type: 'sine', f0: 72, f1: 38, dur: 0.16, gain: 0.42 });
    synth.tone({ type: 'sine', f0: 60, f1: 34, dur: 0.14, gain: 0.26, delay: 0.11 });
    synth.noise({ type: 'lowpass', f0: 240, f1: 80, dur: 0.1, gain: 0.13 });
    m.marks?.pulse(1.45);
    void sc.tw.to(0.28, (k) => m.marks?.pulse(1.45 - k * 0.45), ease.outQuad, 'fx');
    void cine.pulse({ vignette: 0.95 }, { vignette: 0.82 }, 0.25);
  });
}

function tick(pitch = 1): void {
  synth.tone({ type: 'triangle', f0: 1500 * pitch, f1: 1200 * pitch, dur: 0.11, gain: 0.08 });
  synth.noise({ type: 'highpass', f0: 5000, dur: 0.05, gain: 0.1 });
}

/** The sound of the bite: the audio file is a bite crunching the jaws; the synthesized version is a low-frequency heavy hit plus tearing */
function biteSfx(gain = 1, rate = 1): void {
  playOr(biteUrl, () => {
    synth.noise({ type: 'lowpass', f0: 1000, f1: 70, dur: 0.5, gain: 0.6 * gain });
    synth.noise({ type: 'bandpass', f0: 1600, f1: 700, q: 0.6, dur: 0.13, gain: 0.45 * gain });
    synth.tone({ type: 'square', f0: 130, f1: 40, dur: 0.12, gain: 0.08 * gain });
  }, { gain: 0.95 * gain, rate });
  ultSfx.thump(0.8 * gain);
  synth.tone({ type: 'sawtooth', f0: 58, f1: 28, dur: 0.45, gain: 0.16 * gain });
}

// ───────────────────────── windup ─────────────────────────

/** Eyes open → moonrise → howl, eclipse → hunt marks → Endless Night */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const A = act(c);
  const cr = sc.slots[side].creature;
  const h = cr?.worldHeight ?? 1.5;
  const hf = sc.slots[foe].creature?.worldHeight ?? 1.5;
  const fwd = cine.forward(side);
  const head0 = anchorPos(c, 'head', () => sc.head(side));
  const center = sc.center(side);
  const d = density(c);
  const moon = makeMoon(c);
  m.moon = moon;
  const marks = makeMarks(c);
  m.marks = marks;
  const plate = makePlate(c);
  m.plate = plate;
  const eyes = makeEyeFx(c);
  m.eyes = eyes;
  // Compile the new materials' shaders first so there is no hitching midway through the cinematic: compile only walks visible objects,
  // so the black screen and the kill-line ring are turned on first, a temporary jaws and shadow pool are each made, and they are removed once compiled
  plate.warm(true);
  marks.warm(true);
  const wj = makeJaws(c, 1, UP.clone().add(fwd));
  const wp = makePool(c);
  sc.stage.prewarm();
  plate.warm(false);
  marks.warm(false);
  wj.kill();
  wp.kill();

  // Start time of each segment (seconds)
  const T_EYE = 0.12;
  const T_RISE = 0.6;
  const T_HOWL = 1.5;
  const T_ECL = T_HOWL + 1.1;
  const T_HUNT = 2.75;
  const T_DARK = 3.35;
  const T_END = 3.85;

  // Camera positions for moonrise and the howl: a low-angle side shot looking up, the moon hung along the line of sight behind and above the wolf's head
  const mid = center.clone().addScaledVector(UP, h * 0.15);
  const d0 = fitDist(c, h * 0.42, h * 0.7);
  const d1 = fitDist(c, h * 1.35, h * 1.9);
  const riseLook = head0.clone().addScaledVector(UP, h * 0.12);
  // The moon is placed for the camera position at the end of the howl: the raised wolf head just presses against the lower edge of the moon's face
  const howlCam = cine.orbitPos(side, mid, 114, d1 * 0.82, -h * 0.3);
  const mA = moonAlong(c, howlCam, head0.clone().addScaledVector(UP, h * 0.2), 3.5, 0.6, 0.45);

  const tl = sc.gs.timeline('world');
  // ① Announcement: night presses down, the camera at a low angle right in front of the face
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    warmWolf();
    synth.dropMusic(7000);
    synth.noise({ type: 'lowpass', f0: 500, f1: 160, dur: 1.4, gain: 0.16, attack: 0.3 });
    synth.tone({ type: 'sawtooth', f0: 46, f1: 40, dur: 1.6, gain: 0.05, attack: 0.5 });
    void cine.look({ letterbox: 1, desat: 0.4, vignette: 0.82, tint: NIGHT, lift: 0x000004, bloom: 0.75, grain: 0.3 }, 0.4, ease.outQuad);
    cine.track(() => sc.head(side), ['vig']);
    const look = () => anchorPos(c, 'head', () => sc.head(side));
    const p0 = cine.orbitPos(side, head0, 26, d0, -h * 0.05);
    const p1 = cine.orbitPos(side, head0, 24, d0 * 0.82, -h * 0.04);
    cine.cut(p0, look());
    void camPath(c, T_RISE, (k) => [p0.clone().lerp(p1, k), look()], ease.outQuad);
    startHeartbeat(c);
  }, [], 0);
  // ② Eyes open: the eyelids lift all at once and the pupils narrow; red eye glints in both eyes
  tl.to(A, { glare: 1, duration: 0.14, ease: 'power3.out' }, T_EYE);
  tl.call(() => {
    for (const e of sc.eyes(side).length ? sc.eyes(side) : [sc.head(side)]) void sc.vfx.glint(e, RED_HI, h * 0.07, 0.45, 3);
    ultSfx.shing(0.9);
  }, [], T_EYE + 0.06);
  // ③ The crescent on its forehead flashes, the source crystal lights up
  tl.to(A, { glow: 0.5, duration: 0.5, ease: 'power1.inOut' }, 0.35);
  tl.call(() => {
    void sc.vfx.glint(anchorPos(c, 'brand', () => sc.head(side).addScaledVector(UP, h * 0.05)), 0xe8dcff, h * 0.06, 0.45, 2.4);
    synth.tone({ type: 'sine', f0: 1760, f1: 2093, dur: 1.2, gain: 0.03, attack: 0.3 });
  }, [], 0.38);

  // ④ Moonrise: the camera pulls back and down and swings around to the side; the huge moon rises behind the wolf
  tl.call(() => {
    moon.place(mA.pos.clone().addScaledVector(UP, -mA.r * 2.2), mA.r);
    const look0 = anchorPos(c, 'head', () => sc.head(side));
    void camPath(c, T_HOWL - T_RISE, (k) => {
      const yaw = 26 + (100 - 26) * k;
      const dist = d0 * 0.82 + (d1 - d0 * 0.82) * k;
      const pivot = head0.clone().lerp(mid, k);
      return [cine.orbitPos(side, pivot, yaw, dist, -h * 0.04 - h * 0.29 * k), look0.clone().lerp(riseLook, k)];
    }, ease.inOutQuad);
    synth.noise({ type: 'bandpass', f0: 300, f1: 900, q: 0.8, dur: 1.0, gain: 0.12, attack: 0.7 });
    synth.tone({ type: 'sine', f0: 2637, dur: 1.0, gain: 0.02, attack: 0.5, delay: 0.3 });
    // A few wisps of dark purple light dust float up from the source crystal
    for (let i = 0; i < 4; i++)
      void c.wait(i * 0.2).then(() => sc.vfx.emit({ pos: anchorPos(c, 'crystalTip', () => sc.center(side).addScaledVector(UP, h * 0.3)), count: Math.round(6 * d), color: [VIOLET, 0xc8a8ff], speed: [0.2, 0.6], dir: UP, spread: 0.6, life: [0.6, 1.1], size: [0.03, 0.07], sizeEnd: 0.01, radius: h * 0.05, gravity: -0.6, drag: 1, intensity: 0.7 }));
  }, [], T_RISE);
  const rise = { k: 0 };
  tl.to(rise, {
    k: 1,
    duration: 0.95,
    ease: 'power2.out',
    onUpdate: () => {
      moon.place(mA.pos.clone().addScaledVector(UP, -mA.r * 2.2 * (1 - rise.k)), mA.r);
      moon.set(0, Math.min(1, rise.k * 2));
    },
  }, T_RISE);

  // ⑤ Howl: head thrown back, mouth open, the howl rippling out in rings; the eclipse, the moonlight turns blood red
  tl.to(A, { howl: 1, glare: 0.4, duration: 0.4, ease: 'power2.out' }, T_HOWL);
  tl.to(A, { glow: 1, duration: 0.8 }, T_HOWL);
  tl.call(() => {
    m.howl = playOr(howlUrl, () => playHowl(), { gain: 0.62, peakIn: T_ECL - T_HOWL - 0.1 });
    synth.tone({ type: 'sine', f0: 36, dur: 2.2, gain: 0.3, attack: 0.7 });
    m.beatRate = 0.5;
    const look0 = sc.rig.look.clone();
    void camPath(c, T_HUNT - T_HOWL, (k) => {
      const yaw = 100 + 14 * k;
      const dist = d1 * (1 - 0.18 * k);
      const p = cine.orbitPos(side, mid, yaw, dist, -h * 0.33 + h * 0.03 * k);
      return [p, look0.clone().lerp(anchorPos(c, 'head', () => sc.head(side)).addScaledVector(UP, h * 0.1), Math.min(1, k * 1.5))];
    }, ease.linear);
    cine.track(() => anchorPos(c, 'mouth', () => sc.head(side)), ['vig']);
  }, [], T_HOWL);
  // The howl's sound waves: three rings ripple out from the mouth, and the screen warps a little with them
  for (let i = 0; i < 3; i++)
    tl.call(() => {
      const mouth = anchorPos(c, 'mouth', () => sc.head(side));
      const toCam = sc.stage.camera.position.clone().sub(mouth).normalize();
      void sc.vfx.ring(mouth, i === 2 ? BLOOD : 0x5a3aa8, h * 0.06, h * (0.45 + i * 0.2), 0.7, toCam);
      cine.shock(mouth, 0.35 + i * 0.1, 0.6, 0.5);
      sc.rig.addTrauma(0.08 + i * 0.04);
    }, [], T_HOWL + 0.3 + i * 0.28);
  const ecl = { k: 0 };
  tl.to(ecl, { k: 1, duration: T_ECL - T_HOWL - 0.15, ease: 'power1.inOut', onUpdate: () => moon.set(ecl.k, 1) }, T_HOWL + 0.15);
  tl.call(() => void cine.look({ tint: 0xff9aa6, lift: 0x160006, desat: 0.5, bloom: 0.85 }, 0.9, ease.inQuad), [], T_HOWL + 0.2);
  // Total eclipse: a rumble, a flash of red light, a ring of ripples spreading from the moon's center
  tl.call(() => {
    playOr(eclipseUrl, () => ultSfx.thump(0.8), { gain: 0.8 });
    sc.stage.screenFlash(0x5a0010, 0.4, 6);
    cine.shock(mA.pos, 0.8, 0.7, 0.7);
    sc.rig.addTrauma(0.3);
    void sc.vfx.glint(anchorPos(c, 'brand', () => sc.head(side)), RED_HI, h * 0.2, 0.6, 3);
    sc.vfx.emit({ pos: anchorPos(c, 'crystal', () => sc.center(side)), count: Math.round(24 * d), color: [RED, VIOLET, RED_HI], speed: [0.6, 1.8], dir: UP, spread: 0.9, life: [0.5, 0.9], size: [0.04, 0.09], sizeEnd: 0.01, radius: h * 0.1, gravity: -1.2, drag: 1.2, intensity: 0.8 });
    m.beatRate = 0.36;
  }, [], T_ECL);

  // ⑥ Hunt marks: looking at the prey over the shoulder, the claw marks light up one by one, the kill line appears and then doubles; the wolf in the foreground crouches
  const huntCam = () => {
    // Over the shoulder: the camera is behind and above the wolf toward the audience side, the lowered head and ears at the lower left of the foreground, and the prey in the center of the frame
    const base = (cr?.root.position ?? sc.slots[side].home).clone();
    const aud = cine.orbitPos(side, base, 90, 1, 0).sub(base);
    return base.addScaledVector(fwd, -h * 0.42).addScaledVector(aud, h * 0.5).addScaledVector(UP, h * 0.82);
  };


  tl.call(() => {
    const foeC = sc.center(foe);
    const p0 = huntCam();
    const p1 = p0.clone().lerp(foeC, 0.14);
    const look = foeC.clone().addScaledVector(UP, -hf * 0.05);
    cine.cut(p0, look);
    void camPath(c, T_DARK - T_HUNT, (k) => [p0.clone().lerp(p1, k), look], ease.linear);
    void cine.look({ isolate: 0.75, desat: 0.65, vignette: 0.95, tint: 0xffa0aa, lift: 0x120004, grain: 0.45 }, 0.12);
    cine.track(() => sc.center(foe), ['vig']);
    // The blood moon hangs in the sky behind the prey
    const mb = moonAlong(c, p0, look, 5, 0.34, 0.95);
    moon.place(mb.pos, mb.r);
    moon.set(1, 1);
    playOr(growlUrl, () => playGrowl(), { gain: 0.55 });
  }, [], T_HUNT);
  tl.to(A, { howl: 0, glare: 1, duration: 0.22, ease: 'power2.in' }, T_HUNT);
  tl.to(A, { crouch: 1, jaw: 0.3, duration: 0.4, ease: 'power2.out' }, T_HUNT + 0.12);
  // A trace of red eyeshine is left on the silhouette of the wolf's head in the foreground
  tl.to(eyes, { glow: 0.45, duration: 0.2 }, T_HUNT + 0.1);
  const n = m.hunt.marks;
  const gap = n > 0 ? Math.min(0.09, 0.4 / n) : 0;
  for (let i = 0; i < n; i++)
    tl.call(() => {
      marks.ignite(i);
      tick(1 + i * 0.08);
      sc.slots[foe].creature?.setFlash(RED, 0.25);
      void cine.pulse({ tint: 0xffc0c8 }, { tint: 0xffa0aa }, 0.18);
    }, [], T_HUNT + 0.08 + i * gap);
  const tLine = T_HUNT + 0.12 + n * gap;
  tl.call(() => {
    const { line, ultLine, hp } = m.hunt;
    marks.setHp(hp);
    if (line <= 0) return;
    marks.setLine(line);
    marks.flare(0.8);
    tick(0.7);
    const jump = { k: 0 };
    void c.wait(0.12).then(() => {
      ultSfx.shing(0.8);
      synth.tone({ type: 'triangle', f0: 880, f1: 1760, dur: 0.22, gain: 0.1 });
      marks.flare(1);
      void sc.tw.to(0.22, (k) => {
        jump.k = k;
        marks.setLine(line + (ultLine - line) * k);
      }, ease.outBack, 'fx');
      c.ui.float(`斬殺線 ${line}% → ${ultLine}%`, sc.center(foe).addScaledVector(UP, hf * 0.75), 'fl-critlabel');
    });
  }, [], tLine);

  // ⑦ Endless Night: a front-facing low-angle face close-up, the world sinks into darkness, leaving only a pair of red eyes
  tl.call(() => {
    m.beat?.kill();
    m.beat = undefined;
    const em = eyesMid(c);
    const dd = fitDist(c, h * 0.34, h * 0.5);
    const p0 = cine.orbitPos(side, em, 16, dd, -h * 0.04);
    const p1 = cine.orbitPos(side, em, 14, dd * 0.9, -h * 0.035);
    cine.cut(p0, em);
    void camPath(c, T_END - T_DARK + 0.2, (k) => [p0.clone().lerp(p1, k), eyesMid(c)], ease.outQuad);
    void cine.look({ isolate: 0, desat: 0.3, tint: 0xffb0b8, grain: 0.35 }, 0);
    cine.track(() => eyesMid(c), ['vig']);
    synth.noise({ type: 'lowpass', f0: 200, f1: 60, dur: 0.6, gain: 0.12, attack: 0.3 });
    playOr(growlUrl, () => playGrowl(), { gain: 0.75, rate: 0.9 });
  }, [], T_DARK);
  const dark = { a: 0 };
  tl.to(dark, { a: 0.94, duration: 0.16, ease: 'power2.in', onUpdate: () => plate.set(dark.a) }, T_DARK);
  tl.to(eyes, { glow: 1, duration: 0.12, ease: 'power2.out' }, T_DARK + 0.1);
  tl.call(() => {
    for (const e of sc.eyes(side).length ? sc.eyes(side) : [sc.head(side)]) void sc.vfx.glint(e, RED, h * 0.08, 0.4, 7);
    ultSfx.shing(0.55);
  }, [], T_DARK + 0.14);
  tl.set({}, {}, T_END);
  await playTimeline(tl);
}

// ───────────────────────── deliver ─────────────────────────

/** Pounce: leaping up out of the darkness, the eyes dragging red light; the giant jaws take shape on the prey; cut to the target's view, and the jaws close */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const A = act(c);
  const cr = sc.slots[side].creature;
  const fc = sc.slots[foe].creature;
  const h = cr?.worldHeight ?? 1.5;
  const hf = fc?.worldHeight ?? 1.5;
  const wf = fc?.width ?? hf;
  const fwd = cine.forward(side);
  const d = density(c);
  const LUNGE = 0.5;
  const T_JAWS = 0.06;
  const T_CUT = 0.32;
  const T_SNAP = 0.44;

  // Path: from where it stood → in front of the prey (the wolf's mouth against the prey's front), arching in the middle; at the bite all four paws are still off the ground
  const from = (cr?.root.position ?? sc.slots[side].home).clone().setY(0);
  const mouthOff = cr ? anchorPos(c, 'mouth', () => sc.head(side)).sub(cr.root.position).dot(fwd) : h * 0.5;
  const reach = Math.max(h * 0.3, mouthOff) + wf * 0.28;
  const foeRoot = (fc?.root.position ?? sc.slots[foe].home).clone().setY(0);
  const to = foeRoot.clone().addScaledVector(fwd, -reach).setY(h * 0.06);
  const apex = from.clone().lerp(to, 0.5).setY(h * 0.3);
  m.path = { from, to, apex };
  const curve = new THREE.QuadraticBezierCurve3(from, apex, to);
  const foeC = foeRoot.clone().setY(hf * 0.5);
  // Jaws: sized by the prey; the plane faces the target-view camera
  const S = Math.max(hf * 0.46, wf * 0.42) + 0.25;
  // Target view: the prey's audience side at a low angle, looking at the wolf pouncing in; the whole ring of jaws and the wolf's head biting up must both fit in
  const tvLook = foeC.clone().lerp(to.clone().setY(h * 0.62), 0.42);
  const tvPos = cine.orbitPos(foe, tvLook, 70, fitDist(c, S * 3.3, S * 2.2 + reach + h * 0.6), -hf * 0.1);
  m.tv = { pos: tvPos, look: tvLook };
  const jaws = makeJaws(c, S, tvPos.clone().sub(foeC));
  m.jaws = jaws;
  const pool = makePool(c);
  m.pool = pool;
  const eyes = m.eyes;

  const tl = sc.gs.timeline('world');
  // ① Pounce: the darkness recedes, a leap, the eyes dragging red light
  tl.call(() => {
    if (eyes) eyes.trail = true;
    const pl = m.plate;
    if (pl) void sc.tw.to(0.14, (k) => pl.set(0.94 * (1 - k)), ease.outQuad, 'fx');
    playOr(lungeUrl, () => ultSfx.swell(LUNGE, 0.3), { gain: 0.8, peakIn: LUNGE * 0.55 });
    ultSfx.swell(LUNGE, 0.18);
    sc.rig.addTrauma(0.2);
    m.marks?.fade(0.55);
    void cine.look({ isolate: 0, desat: 0.25, tint: 0xffc8d0, lift: 0x0c0003, lines: 0.25, linesColor: RED_HI, radial: 0.3, vignette: 0.8, grain: 0.3 }, 0.12);
    cine.track(() => sc.head(side), ['radial', 'vig']);
    sc.vfx.smoke({ pos: from.clone().setY(0.15), count: Math.round(30 * d), color: [0x120820, 0x2a1040], speed: [1, 3], dir: fwd.clone().negate().add(UP), spread: 0.9, life: [0.4, 0.8], size: [0.3, 0.6], sizeEnd: 0.9, radius: h * 0.3, drag: 2 });
    if (cr) cr.moving = 0;
    // Follow shot: audience side 86°, the camera pans along with the wolf, slightly ahead
    const dist = fitDist(c, h * 1.35, h * 2.6);
    void camPath(c, T_CUT, (k) => {
      const u = Math.min(1, (k * T_CUT) / LUNGE);
      const p = curve.getPoint(u);
      const lead = p.clone().lerp(foeC, 0.18 + 0.2 * u).setY(h * 0.45);
      return [cine.orbitPos(side, lead, 86, dist, h * 0.06), lead];
    }, ease.linear);
  }, [], 0);
  tl.to(A, { crouch: 0, leap: 1, duration: 0.09, ease: 'power3.out' }, 0);
  const u = { k: 0 };
  tl.to(u, {
    k: 1,
    duration: LUNGE,
    ease: 'none',
    onUpdate: () => {
      if (!cr) return;
      const p = curve.getPoint(u.k);
      cr.root.position.copy(p);
      // Nose pointing up at takeoff and down on landing
      cr.pose.rotation.x = -0.22 + 0.4 * u.k;
    },
  }, 0);
  // Afterimages and shadow smoke along the way
  const ghosts = Math.round(7 * d);
  for (let i = 0; i < ghosts; i++)
    tl.call(() => {
      if (!cr) return;
      void sc.vfx.ghost(cr.body, VIOLET, 0.3, 0.42);
      sc.vfx.smoke({ pos: cr.root.position.clone().setY(0.12), count: Math.round(6 * d), color: [0x0c0618, 0x2a1040], speed: [0.2, 0.8], life: [0.3, 0.6], size: [0.35, 0.7], sizeEnd: 0.15, radius: 0.25, drag: 2 });
    }, [], 0.04 + (i * (LUNGE - 0.12)) / Math.max(1, ghosts - 1));
  // ② The jaws take shape: a shadow spreads at the prey's feet, and the upper and lower crescents open
  tl.call(() => {
    synth.noise({ type: 'bandpass', f0: 200, f1: 900, q: 1.5, dur: 0.35, gain: 0.22, attack: 0.1 });
    synth.tone({ type: 'sine', f0: 1320, f1: 1760, dur: 0.3, gain: 0.04 });
    for (const y of [1, -1]) sc.vfx.smoke({ pos: foeC.clone().addScaledVector(UP, y * S * 0.9), count: Math.round(18 * d), color: [0x0c0618, 0x2a1040], speed: [0.5, 1.6], life: [0.3, 0.6], size: [0.3, 0.6], sizeEnd: 0.8, radius: S * 0.5, drag: 2 });
  }, [], T_JAWS);
  tl.to(jaws.k, { show: 1, glow: 1, duration: 0.2, ease: 'back.out(1.6)' }, T_JAWS);
  const pk = { r: 0, a: 0 };
  tl.to(pk, { r: S * 1.5, a: 0.85, duration: 0.25, ease: 'power2.out', onUpdate: () => pool.set(pk.r, pk.a) }, T_JAWS);
  // ③ Mouth opens
  tl.to(A, { jaw: 1, duration: 0.18, ease: 'power2.out' }, 0.15);
  // ④ Target view: the prey's audience side, low angle, looking back at the wolf pouncing in, the blood moon behind the wolf
  tl.call(() => {
    cine.cut(tvPos, tvLook);
    void camPath(c, LUNGE - T_CUT + 0.1, (k) => [tvPos.clone().lerp(tvLook, 0.08 * k), tvLook], ease.outQuad);
    void cine.look({ lines: 0.2, radial: 0.2 }, 0.1);
    cine.track(() => foeC, ['radial', 'vig']);
    const mb = moonAlong(c, tvPos, to.clone().setY(h * 0.7), 6, 0.4, 1.1);
    m.moon?.place(mb.pos, mb.r);
  }, [], T_CUT);
  // ⑤ Snap shut
  tl.to(jaws.k, { open: 0, duration: LUNGE - T_SNAP, ease: 'power4.in' }, T_SNAP);
  tl.set({}, {}, LUNGE);
  await playTimeline(tl);
}

// ───────────────────────── impact ─────────────────────────

/** Bite: the jaws lock into a ring and the wolf bites the prey; red flash, shockwave; the jaws shatter, the wolf lands, the camera pulls back; on a hunt kill, a second bite */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const A = act(c);
  const cr = sc.slots[side].creature;
  const h = cr?.worldHeight ?? 1.5;
  const hf = sc.slots[foe].creature?.worldHeight ?? 1.5;
  const foeC = sc.center(foe);
  const d = density(c);
  const first = ev.hitIndex <= 1;
  const last = ev.hitIndex >= ev.hits;
  // Life after the hit; the hunt kill check (life after the hit ≤ the ultimate's kill line)
  const fv = ev.view.sides[foe];
  const f = fv.team[fv.active];
  const hpAfter = f && f.maxHp > 0 ? (f.hp / f.maxHp) * 100 : 0;
  const hunted = !ev.ko && !!f && f.hp > 0 && m.hunt.ultLine > 0 && hpAfter <= m.hunt.ultLine;
  m.hunted = hunted && last;
  m.marks?.flare(1.2);
  m.marks?.setHp(hpAfter);
  if (!first) {
    sc.vfx.emit({ pos: foeC, count: Math.round(20 * d), color: [RED, BLOOD], speed: [2, 5], life: [0.2, 0.4], size: [0.04, 0.09], radius: hf * 0.3, intensity: 0.8 });
    if (last) finishBite(c, hpAfter);
    return;
  }
  const jaws = m.jaws;
  const camDir = sc.stage.camera.position.clone().sub(foeC).normalize();
  // The director's white flash mixed into the night turns into one frame of dead grey: replace it with a blood-red flash (this hook runs after the director, so it can cover it)
  sc.stage.screenFlash(0xff3050, 0.4, 7);
  sc.stage.chromatic(1.5);
  biteSfx();
  if (jaws) {
    jaws.k.open = 0;
    jaws.k.glow = 1.15;
    jaws.k.shake = 1;
    void sc.tw.to(0.35, (k) => (jaws.k.shake = 1 - k), ease.outQuad, 'fx');
  }
  // The ring of the total eclipse: a red ring rippling out from the bite, sparks where the tips on the two sides interlock
  void sc.vfx.ring(foeC, RED, hf * 0.3, hf * 1.8 + 1.2, 0.55, camDir);
  void sc.vfx.ring(foeC, BLOOD, hf * 0.2, hf * 1.2 + 0.6, 0.4, camDir);
  if (jaws) for (const sx of [-1, 1]) {
    const p = jaws.root.localToWorld(v3(sx * jaws.S * 0.88, 0, jaws.S * 0.1));
    void sc.vfx.glint(p, RED_HI, hf * 0.3, 0.35, 3.5);
    sc.vfx.emit({ pos: p, count: Math.round(24 * d), color: [RED_HI, RED, 0xffffff], speed: [3, 7], life: [0.15, 0.35], size: [0.03, 0.07], sizeEnd: 0.01, radius: 0.1, drag: 2, intensity: 1 });
  }
  sc.vfx.smoke({ pos: foeC, count: Math.round(50 * d), color: [0x1a0410, 0x4a0a1c], speed: [1.5, 4], life: [0.4, 0.8], size: [0.25, 0.5], sizeEnd: 0.05, radius: hf * 0.3, drag: 2 });
  sc.vfx.emit({ pos: foeC, count: Math.round(40 * d), color: [RED, BLOOD, RED_HI], speed: [2, 6], dir: cine.forward(side), spread: 1.0, life: [0.3, 0.6], size: [0.05, 0.12], sizeEnd: 0.02, radius: hf * 0.25, gravity: -4, drag: 1.5, intensity: 0.8 });
  sc.slots[foe].creature?.setFlash(RED, 0.75);
  cine.shock(foeC, 1.3, 0.6, 1.2);
  cine.track(() => sc.center(foe), ['vig', 'radial']);
  void cine.pulse({ radial: 0.55, lift: 0x300008 }, { radial: 0, lift: 0x080002 }, 0.45);
  void cine.look({ isolate: 0, desat: 0.3, tint: 0xffc4cc, vignette: 0.78, grain: 0.3, lines: 0, bloom: 0.72 }, 0.45);
  if (m.eyes) m.eyes.trail = false;
  // The wolf bites down: the mouth closes halfway
  const tl = sc.gs.timeline('world');
  tl.to(A, { jaw: 0.3, duration: 0.05, ease: 'power3.in' }, 0);
  // After the hit-stop: the jaws shatter, the wolf lands, the nose levels out, and the glow of the eyes goes out
  tl.call(() => {
    jaws?.shatter();
    const pool = m.pool;
    if (pool) void sc.tw.to(0.6, (k) => pool.set((jaws?.S ?? 1) * 1.5 * (1 + k * 0.2), 0.85 * (1 - k)), ease.inQuad, 'fx');
  }, [], 0.3);
  if (cr) {
    const y0 = cr.root.position.y;
    const drop = { k: 0 };
    tl.to(drop, { k: 1, duration: 0.24, ease: 'power2.in', onUpdate: () => {
      cr.root.position.y = y0 * (1 - drop.k);
      cr.pose.rotation.x = 0.18 * (1 - drop.k);
    } }, 0.14);
  }
  tl.to(A, { leap: 0, crouch: 0.6, duration: 0.24, ease: 'power2.out' }, 0.14);
  tl.to(A, { jaw: 0, glare: 0.5, duration: 0.4, ease: 'power1.inOut' }, 0.45);
  tl.to(A, { crouch: 0, duration: 0.5, ease: 'power1.inOut' }, 0.6);
  if (m.eyes) tl.to(m.eyes, { glow: 0, duration: 0.4 }, 0.2);
  // Camera: the hit-stop frames hold the target's view, then pull back and up (retreating from the current position, no jump to another camera position)
  tl.call(() => {
    const r = sc.rig;
    const look = r.look.clone().lerp(sc.center(side).lerp(sc.center(foe), 0.5), 0.5).addScaledVector(UP, h * 0.15);
    const pos = look.clone().add(r.pos.clone().sub(r.look).multiplyScalar(1.5)).addScaledVector(UP, h * 0.35);
    void cine.shot(pos, look, 0.9, ease.outCubic);
  }, [], 0.3);
  if (last) tl.call(() => finishBite(c, hpAfter), [], 0.5);
  void playTimeline(tl);
}

/** After the last bite: if the hunt kill holds, bite a second time along a diagonal; then wrap up the post-processing and pull back to the wide shot */
function finishBite(c: UltCtx, hpAfter: number): void {
  const m = mem(c);
  if (!m.hunted) {
    settleNight(c, 0.75);
    return;
  }
  const { sc, cine, foe } = c;
  const hf = sc.slots[foe].creature?.worldHeight ?? 1.5;
  const foeC = sc.center(foe);
  const S = (m.jaws?.S ?? hf * 0.5) * 0.85;
  const tvDir = sc.stage.camera.position.clone().sub(foeC);
  const jaws = makeJaws(c, S, tvDir);
  const d = density(c);
  const tl = sc.gs.timeline('world');
  jaws.k.roll = 0.75;
  tl.to(jaws.k, { show: 1, glow: 1.2, duration: 0.12, ease: 'power2.out' }, 0);
  tl.to(jaws.k, { open: 0, duration: 0.07, ease: 'power4.in' }, 0.14);
  tl.call(() => {
    biteSfx(0.8, 1.12);
    playOr(eclipseUrl, () => ultSfx.thump(0.6), { gain: 0.5 });
    jaws.k.shake = 1;
    sc.stage.screenFlash(0x5a0010, 0.5, 7);
    sc.stage.chromatic(1.3);
    sc.rig.addTrauma(0.55);
    m.moon?.set(1, 1);
    m.marks?.flare(1);
    void sc.tw.to(0.35, (k) => m.marks?.setHp(hpAfter * (1 - k)), ease.inQuad, 'fx');
    const camDir = tvDir.clone().normalize();
    void sc.vfx.ring(foeC, RED, hf * 0.3, hf * 1.6 + 1, 0.5, camDir);
    sc.vfx.smoke({ pos: foeC, count: Math.round(40 * d), color: [0x120410, 0x3a0814], speed: [1, 3], life: [0.5, 0.9], size: [0.3, 0.6], sizeEnd: 0.05, radius: hf * 0.3, drag: 2 });
    sc.slots[foe].creature?.setFlash(BLOOD, 1);
    void cine.pulse({ desat: 0.85, tint: 0xff7a86, lift: 0x1a0004, vignette: 1 }, { desat: 0.25, tint: 0xffd8dc, lift: 0x000000, vignette: 0.6 }, 0.9);
    c.ui.float('獵殺！', sc.top(foe).addScaledVector(UP, 0.6), 'fl-critlabel');
  }, [], 0.21);
  tl.call(() => jaws.shatter(), [], 0.5);
  tl.call(() => jaws.kill(), [], 2.2);
  tl.call(() => settleNight(c, 0.55), [], 0.55);
  m.layers.push({ kill: () => jaws.kill(), get alive() { return true; } });
  void playTimeline(tl);
}

/**
 * Wrap up the cinematic's post-processing (night eased back by half, red faded out); after holding for hold seconds the camera pulls back to the wide shot: the post-hit battle text is read there.
 * The blood moon and hunt marks stay until after.
 */
function settleNight(c: UltCtx, hold: number): void {
  const { sc, cine } = c;
  void cine.look({ lines: 0, radial: 0, haze: 0, isolate: 0, bloom: sc.stage.bloomBase * 0.85, tint: 0xc8c4e8, lift: 0x000000, desat: 0.15, vignette: 0.55, grain: 0 }, 0.6);
  void c.wait(hold).then(() => {
    cine.track(null);
    void sc.rig.reset(0.8);
    void cine.look({ fov: 1, roll: 0 }, 0.8);
    void sc.tw.to(0.6, (k) => mem(c).marks?.fade(1 - k * 0.7), ease.inQuad, 'fx');
  });
}

// ───────────────────────── Blocked, missed, wrap-up ─────────────────────────

/** Blocked: the jaws bite on the barrier and crumble, and the wolf is bounced back */
async function guarded(c: UltCtx): Promise<void> {
  const { sc, side } = c;
  const m = mem(c);
  const A = act(c);
  const cr = sc.slots[side].creature;
  const jaws = m.jaws;
  if (m.eyes) m.eyes.trail = false;
  if (jaws) {
    // The barrier holds: the two crescents stop half open, shake violently, then crumble
    jaws.k.open = 0.45;
    jaws.k.shake = 1;
    jaws.k.glow = 1.4;
  }
  biteSfx(0.7, 0.9);
  void ultGuarded(c);
  const tl = sc.gs.timeline('world');
  tl.call(() => jaws?.shatter(), [], 0.2);
  tl.to(A, { jaw: 0, leap: 0, crouch: 0.5, duration: 0.2 }, 0.05);
  if (cr && m.path) {
    const p0 = cr.root.position.clone();
    const back = m.path.to.clone().lerp(m.path.from, 0.35).setY(0);
    const k = { t: 0 };
    tl.to(k, { t: 1, duration: 0.35, ease: 'power2.out', onUpdate: () => {
      cr.root.position.lerpVectors(p0, back, k.t);
      cr.root.position.y = Math.max(0, p0.y * (1 - k.t) + Math.sin(k.t * Math.PI) * 0.4);
      cr.pose.rotation.x = -0.25 * Math.sin(k.t * Math.PI);
    } }, 0.05);
  }
  if (m.eyes) tl.to(m.eyes, { glow: 0, duration: 0.3 }, 0.1);
  tl.set({}, {}, 0.8);
  await playTimeline(tl);
}

/** After a block or a miss: the jaws shatter, post-processing eased back by half, pull back to the wide shot */
function settle(c: UltCtx): void {
  const m = mem(c);
  m.jaws?.shatter();
  if (m.eyes) {
    m.eyes.trail = false;
    m.eyes.glow = 0;
  }
  m.plate?.set(0);
  settleNight(c, 0.4);
}

/** Wrap-up: the wolf drops its pose, the blood moon sinks and the hunt marks go out, and all temporary objects are removed */
async function after(c: UltCtx): Promise<void> {
  const { sc, side } = c;
  const m = mem(c);
  const A = act(c);
  m.beat?.kill();
  m.plate?.kill();
  m.plate = undefined;
  m.howl?.fade(0.4);
  const cr = sc.slots[side].creature;
  if (cr) {
    cr.root.visible = true;
    cr.setOpacity(1);
    cr.pose.scale.setScalar(1);
    cr.pose.position.set(0, 0, 0);
    cr.pose.rotation.x = 0;
    cr.moving = 0;
  }
  const tl = sc.gs.timeline('world');
  tl.to(A, { glare: 0, howl: 0, crouch: 0, leap: 0, jaw: 0, glow: 0, duration: 0.4, ease: 'power1.inOut' }, 0);
  const fade = { k: 0 };
  tl.to(fade, { k: 1, duration: 0.5, ease: 'power1.inOut', onUpdate: () => {
    m.moon?.set(1 - fade.k * 0.6, 1 - fade.k);
    m.marks?.fade((1 - fade.k) * 0.3);
    m.pool?.set((m.jaws?.S ?? 1) * 1.5, 0);
  } }, 0);
  tl.set({}, {}, 0.5);
  await playTimeline(tl);
  for (const k of ['glare', 'howl', 'crouch', 'leap', 'jaw', 'glow']) if (k in A) A[k] = 0;
  m.moon?.kill();
  m.marks?.kill();
  m.jaws?.kill();
  m.pool?.kill();
  m.eyes?.kill();
  for (const l of m.layers) l.kill();
  m.layers = [];
}

export default defineSsr({
  windup,
  deliver,
  impact,
  // The impact at night: the director's white flash and element light orb would wash the eclipse red out to a chalky grey, so the impact visuals are made entirely by impact
  quietHit: true,
  guarded,
  settle,
  after,
});
