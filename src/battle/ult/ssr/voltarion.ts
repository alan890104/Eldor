// Voltarion, the Storm Qilin, "Ninefold Judgment":
//   Dark sky: a dry thunderclap, a bolt strikes the sky above the opponent's head and the sky is pressed to deep indigo; nine thunder rings (the Nine Heavens) rise from there; the qilin's horn and thunder markings turn white-gold, and the charge becomes thunder orbs circling its body
//   Nine Heavens countdown: the rings light up one by one from nine down to one, counting faster and faster, with hard cuts on screen (signature shots: looking up at the ring tunnel from the opponent's feet / horn close-up / the opponent's face / wide shot); the orbs spin ever faster; after "one" lights up, it holds on the horn with a slow push-in, eye glint
//   Thunder step: electric light and afterimages under the hooves, then a cut to the qilin's own point of view, rushing from where it stood to the opponent in 0.12 s, the world lunging at the camera
//   Call to heaven: the orbs are all pulled into the horn; cut to a fixed, pulled-back shot (the "pause" after the quick cuts), a bolt rises from the horn tip straight up the Nine Heavens, passing through the rings one by one
//   Judgment: same shot, the nine rings blaze from top to bottom, and 1 + charge heavenly bolts strike down along the pillars of the rings
//   Awe: at the moment of impact one frame of inverted color, time freezes; the bolt pillars hang in the wide shot first, then a hard cut into a black-and-white close-up, the opponent a black shadow with a golden lightning outline and leaping arcs floating over it;
//         a late thunderclap, time resumes, color returns, the nine rings collapse from top to bottom, and thunder markings are burned into the ground

import * as THREE from 'three';
import { playOr, playSample, preloadSamples, type SampleVoice } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import crackUrl from '../../../audio/sfx/voltarion-crack.mp3';
import neighUrl from '../../../audio/sfx/voltarion-neigh.mp3';
import rollUrl from '../../../audio/sfx/voltarion-roll.mp3';
import strikeUrl from '../../../audio/sfx/voltarion-strike.mp3';
import { crackTex } from '../../../render/fxtex.ts';
import { glowTex } from '../../../render/textures.ts';
import { ease } from '../../../render/tween.ts';
import type { SpiritMaterial } from '../../../render/spiritToon.ts';
import type { FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, eyeGlint, settle } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [crackUrl, neighUrl, strikeUrl, rollUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const VOLT = 0xfff066;
const VOLT_HI = 0xffffff;
const BOLT = 0xf6ff8a;
const GOLD = 0xffd23a;
const LAV = 0xc8a0ff;
const INDIGO = 0x06041c;
const TIERS = 9;
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Shot = [THREE.Vector3, THREE.Vector3, number];

interface Rings {
  pos(i: number): THREE.Vector3;
  /** Fine arcs keep jumping between the rings (during the countdown; switched off after the call to heaven) */
  set crackle(on: boolean);
  /** A ring emerges (a thin dark purple ring) */
  reveal(i: number): void;
  /** A ring lights up (gold, arcs) */
  light(i: number): void;
  /** The whole ring blazes for a moment */
  flare(i: number, amt?: number): void;
  /** Collapse: starting from ring i, one ring every gap seconds in direction dir (-1 = top to bottom) */
  collapse(from: number, dir: 1 | -1, gap: number): void;
  kill(): void;
}
interface Orbs {
  set speed(v: number);
  set gather(v: number);
  burst(): void;
  kill(): void;
}
interface Mem {
  /** Charge at the moment of casting */
  n: number;
  rings?: Rings;
  orbs?: Orbs;
  skel?: FxLayer;
  /** The camera during the freeze: it takes over itself every frame (on a knock-out the director pulls the camera back during hit-stop, and it must not snatch it away) */
  camHold?: FxLayer;
  xray?: THREE.ShaderMaterial;
  glows?: { mats: THREE.MeshBasicMaterial[]; orig: THREE.Color[] };
  /** During the freeze all the opponent's glowing parts are pressed to black (pure black silhouette); put back on resume */
  foeGlows?: { mats: THREE.MeshBasicMaterial[]; orig: THREE.Color[] };
  /** Opponent parts hidden during the freeze: materials in the new model that do not take the hit flash (eye highlights and so on); hiding them is what makes the silhouette pure black */
  foeHidden?: THREE.Object3D[];
  /** Sky flash (decays on its own, layered over the arena's own lightning) */
  sky: number;
  skyPrev: number;
  foeDark: boolean;
  /** In the freeze (for scheduling the time resume) */
  frozen: boolean;
  /** The sound of the heavenly bolt: cut at the freeze frame so the whole world goes quiet */
  strike?: SampleVoice | null;
}
const mem = (c: UltCtx): Mem => (c.mem.vlt ??= { n: 0, sky: 0, skyPrev: 0, foeDark: false, frozen: false }) as Mem;

const heightOf = (c: UltCtx, side: number) => c.sc.slots[side as 0 | 1].creature?.worldHeight ?? 1.5;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const jitter = (p: THREE.Vector3, r: number) => p.clone().add(v3(rand(-r, r), rand(-r, r) * 0.3, rand(-r, r)));

/** Charge stacks at casting */
function charges(c: UltCtx): number {
  const sd = c.view.sides[c.side];
  return Math.max(0, Math.min(3, sd.team[sd.active]?.charges ?? 0));
}

/** The caster's named anchors (world coordinates); returns null when the legacy model has no anchors */
function anchorPos(c: UltCtx, name: string): THREE.Vector3 | null {
  const cr = c.sc.slots[c.side].creature;
  const a = cr?.anchor(name);
  if (!cr || !a) return null;
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}

/** The horn tip: the new model uses the hornTip anchor; the legacy model falls back to a position estimated in the head's coordinate frame */
function hornTip(c: UltCtx): THREE.Vector3 {
  const tip = anchorPos(c, 'hornTip');
  if (tip) return tip;
  const cr = c.sc.slots[c.side].creature;
  if (!cr) return c.sc.head(c.side);
  cr.root.updateMatrixWorld(true);
  return cr.head.localToWorld(v3(0, 0.42, 0.17));
}

/** The caster's action weights (the new model's act; writing them on the legacy model has no effect) */
function actOf(c: UltCtx): Record<string, number> | null {
  return c.sc.slots[c.side].creature?.act ?? null;
}

/** Flash the sky (the arena's sky dome has uFlash; it decays on its own, without disturbing the arena's own lightning) */
function sky(c: UltCtx, amt: number): void {
  const m = mem(c);
  m.sky = Math.max(m.sky, amt);
}
function tickSky(c: UltCtx, dt: number): void {
  const m = mem(c);
  const u = c.sc.arena.skyMat?.uniforms.uFlash;
  if (!u) return;
  u.value = Math.max(0, u.value - m.skyPrev) + m.sky;
  m.skyPrev = m.sky;
  m.sky *= Math.exp(-dt * 7);
}

// ───────────────────────── Model ─────────────────────────

/** The horn, thunder markings and mane lightning all light up to white-gold (the new model has no glowing parts, so the charge weight is used instead: the thunder horn, thunder crystal, hoof-sole lightning and eyes brighten) */
function brighten(c: UltCtx, k: number): void {
  const m = mem(c);
  const cr = c.sc.slots[c.side].creature;
  if (!cr) return;
  cr.act.charge = k;
  m.glows ??= { mats: [...cr.glows], orig: cr.glows.map((g) => g.color.clone()) };
  const white = new THREE.Color(VOLT_HI);
  m.glows.mats.forEach((g, i) => g.color.copy(m.glows!.orig[i]).lerp(white, 0.3 * k).multiplyScalar(1 + 0.15 * k));
}

/** Charge thunder orbs: circle in front of the qilin's chest, spinning ever faster; all pulled into the horn tip at the call to heaven */
function makeOrbs(c: UltCtx, n: number): Orbs {
  const { sc, side } = c;
  const h = heightOf(c, side);
  const g = new THREE.Group();
  const tex = glowTex();
  const sprites: THREE.Sprite[] = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(i % 2 ? VOLT_HI : VOLT).multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.scale.setScalar(h * 0.16);
    g.add(s);
    sprites.push(s);
  }
  let speed = 3;
  let gather = 0;
  let ang = 0;
  let acc = 0;
  const layer = sc.vfx.layer(g, (dt) => {
    ang += speed * dt;
    const cr = sc.slots[side].creature;
    const center = sc.center(side);
    const tip = hornTip(c);
    const R = h * 0.42;
    acc += dt * (6 + speed);
    const spark = acc > 1;
    if (spark) acc = 0;
    sprites.forEach((s, i) => {
      const a = ang + (i * Math.PI * 2) / Math.max(1, n);
      const orbit = center.clone().add(v3(Math.cos(a) * R, Math.sin(a * 2 + i) * R * 0.25, Math.sin(a) * R));
      s.position.copy(orbit.lerp(tip, gather));
      s.scale.setScalar(h * (0.16 + 0.05 * Math.sin(ang * 3 + i)) * (1 - gather * 0.5));
      if (spark && cr) sc.vfx.emit({ pos: s.position, count: 2, color: [VOLT, BOLT], speed: [0.2, 0.8], life: [0.12, 0.25], size: [0.03, 0.06], sizeEnd: 0.01, drag: 2, intensity: 0.8 });
    });
  });
  return {
    set speed(v: number) {
      speed = v;
    },
    set gather(v: number) {
      gather = v;
    },
    burst() {
      const tip = hornTip(c);
      sc.vfx.emit({ pos: tip, count: 10 + n * 8, color: [VOLT, VOLT_HI], speed: [1, 3], dir: UP, spread: 0.6, life: [0.15, 0.35], size: [0.04, 0.09], sizeEnd: 0.01, drag: 2, intensity: 0.85 });
    },
    kill: () => layer.kill(),
  };
}

// ───────────────────────── Nine Heavens thunder rings ─────────────────────────

/** One ring: the radius shakes with angular noise (like a ring of lightning); once lit it gets two extra layers of fast-spinning arcs; on flare the whole ring blazes */
function ringMat(seed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(LAV).multiplyScalar(1.25) }, uHot: { value: new THREE.Color(0xfff8d0) }, uGold: { value: new THREE.Color(GOLD).multiplyScalar(1.1) }, uLit: { value: 0 }, uFlare: { value: 0 }, uT: { value: 0 }, uSeed: { value: seed }, uA: { value: 0 }, uW: { value: 0.015 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uHot; uniform vec3 uGold; uniform float uLit; uniform float uFlare; uniform float uT; uniform float uSeed; uniform float uA; uniform float uW;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float jit = 0.03 * sin(a * 9.0 + uT * 23.0 + uSeed) + 0.02 * sin(a * 23.0 - uT * 31.0) + 0.015 * sin(a * 41.0 + uT * 57.0 + uSeed);
        float R = 0.78 + jit * (0.3 + uLit);
        float d = abs(r - R);
        // uW: line width (adjusted every frame by camera distance so it stays a visible line from afar)
        float line = exp(-d / uW) * (1.0 + 0.05 * uLit);
        float glow = exp(-d / (uW * 6.0)) * (0.14 + 0.12 * uLit + uFlare * 0.35);
        float arc = smoothstep(0.55, 1.0, sin(a * 3.0 - uT * 14.0 + uSeed)) * exp(-d / (uW * 2.5)) * uLit;
        float arc2 = smoothstep(0.7, 1.0, sin(a * 5.0 + uT * 21.0 - uSeed)) * exp(-d / (uW * 2.5)) * uLit * 0.7;
        float disc = exp(-r * r * 3.0) * uFlare * 0.05;
        float alpha = (line + glow + arc + arc2 + disc) * uA * smoothstep(1.0, 0.95, r);
        vec3 base = mix(uCol, uGold, uLit);
        vec3 col = mix(base, uHot, clamp(line * 0.35 * uLit + uFlare * 0.55, 0.0, 1.0));
        gl_FragColor = vec4(col * alpha, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** Nine thunder rings: standing above the opponent's head, larger the higher they are (a funnel-shaped Nine Heavens) */
function makeRings(c: UltCtx): Rings {
  const { sc, foe } = c;
  const hf = heightOf(c, foe);
  const base = sc.slots[foe].home.clone();
  const scaleR = sc.portrait ? 0.7 : 1;
  const geo = new THREE.PlaneGeometry(2, 2);
  geo.rotateX(-Math.PI / 2);
  const root = new THREE.Group();
  const mats: THREE.ShaderMaterial[] = [];
  const meshes: THREE.Mesh[] = [];
  const ys: number[] = [];
  const rs: number[] = [];
  const st = Array.from({ length: TIERS }, () => ({ a: 0, aTo: 0, flare: 0, fall: -1 }));
  for (let i = 0; i < TIERS; i++) {
    const mat = ringMat(i * 1.7);
    const m = new THREE.Mesh(geo, mat);
    ys.push(hf * 1.1 + 1.8 + i * 1.3);
    rs.push((0.8 + hf * 0.3 + i * 0.45) * scaleR);
    m.position.set(base.x, ys[i], base.z);
    m.scale.setScalar(rs[i]);
    m.renderOrder = 12;
    root.add(m);
    mats.push(mat);
    meshes.push(m);
  }
  let crackle = false;
  let arcT = 0;
  const layer = sc.vfx.layer(root, (dt, t) => {
    tickSky(c, dt);
    if (crackle) {
      arcT += dt;
      if (arcT > 0.09) {
        arcT = 0;
        const i = Math.floor(Math.random() * (TIERS - 1));
        const a = Math.random() * Math.PI * 2;
        const b = a + rand(-1, 1);
        zap(c, v3(base.x + Math.cos(a) * rs[i] * 0.78, ys[i], base.z + Math.sin(a) * rs[i] * 0.78), v3(base.x + Math.cos(b) * rs[i + 1] * 0.78, ys[i + 1], base.z + Math.sin(b) * rs[i + 1] * 0.78), i % 2 ? VOLT : LAV, 0.1, 0.02, 0.85, 0.3);
      }
    }
    const cam = sc.stage.camera.position;
    for (let i = 0; i < TIERS; i++) {
      const s = st[i];
      const u = mats[i].uniforms;
      u.uT.value = t;
      u.uW.value = THREE.MathUtils.clamp((cam.distanceTo(meshes[i].position) * 0.0032) / rs[i], 0.009, 0.05);
      s.a += (s.aTo - s.a) * Math.min(1, dt * 18);
      s.flare = Math.min(1, s.flare) * Math.exp(-dt * 11);
      u.uFlare.value = s.flare;
      if (s.fall >= 0) {
        // Collapse: falling down, shrinking, dimming, and finally going out
        s.fall += dt;
        const k = Math.min(1, s.fall / 0.28);
        meshes[i].position.y = ys[i] - ease.inQuad(k) * 1.6;
        meshes[i].scale.setScalar(rs[i] * (1 - k * 0.6));
        u.uA.value = s.a * (1 - k);
      } else u.uA.value = s.a;
    }
  }, () => {
    geo.dispose();
    for (const m of mats) m.dispose();
  });
  return {
    pos: (i) => v3(base.x, ys[Math.max(0, Math.min(TIERS - 1, i))], base.z),
    set crackle(on: boolean) {
      crackle = on;
    },
    reveal(i) {
      st[i].aTo = 0.9;
      st[i].flare = 1;
      if (i === TIERS - 1) crackle = true;
    },
    light(i) {
      st[i].aTo = 1;
      st[i].flare = 1;
      mats[i].uniforms.uLit.value = 1;
      const p = v3(base.x, ys[i], base.z);
      sc.vfx.emit({ pos: p, count: 10, color: [VOLT, VOLT_HI], speed: [0.3, 1.2], life: [0.2, 0.4], size: [0.06, 0.14], sizeEnd: 0.02, radius: rs[i] * 0.78, drag: 2, intensity: 0.8 });
    },
    flare(i, amt = 1) {
      st[i].flare = Math.max(st[i].flare, amt);
    },
    collapse(from, dir, gap) {
      for (let k = 0; k < TIERS; k++) {
        const i = from + dir * k;
        if (i < 0 || i >= TIERS) break;
        void sc.tw.wait(k * gap, 'fx').then(() => {
          if (!layer.alive || st[i].fall >= 0) return;
          st[i].fall = 0;
          st[i].flare = 0.8;
          const p = v3(base.x, ys[i], base.z);
          void sc.vfx.ring(p, VOLT, rs[i] * 0.7, rs[i] * 1.3, 0.3, UP);
          sc.vfx.emit({ pos: p, count: 16, color: [VOLT, BOLT, LAV], speed: [0.5, 2], life: [0.4, 0.8], size: [0.05, 0.12], sizeEnd: 0.02, radius: rs[i] * 0.78, gravity: 6, drag: 1, intensity: 0.85 });
          synth.tone({ type: 'square', f0: 900 - i * 60, f1: 200, dur: 0.09, gain: 0.03 });
        });
      }
    },
    kill: () => layer.kill(),
  };
}

// ───────────────────────── Lightning ─────────────────────────

/** Lightning: a polyline tube (not the built-in bolt, whose white core is too bright), with controllable brightness, strobing, and a fading tail */
function zap(c: UltCtx, from: THREE.Vector3, to: THREE.Vector3, col: THREE.ColorRepresentation, dur: number, thick: number, inten = 1, wobble = 0.1): void {
  const dir = to.clone().sub(from);
  const len = dir.length();
  if (len < 1e-3) return;
  const side = v3(-dir.z, 0, dir.x);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const up = dir.clone().normalize().cross(side).normalize();
  const n = 6 + Math.min(14, Math.round(len * 1.5));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const p = from.clone().lerp(to, i / n);
    if (i > 0 && i < n) {
      const w = len * wobble * (0.4 + 0.6 * Math.sin((i / n) * Math.PI));
      p.addScaledVector(side, (Math.random() - 0.5) * w).addScaledVector(up, (Math.random() - 0.5) * w);
    }
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
  const g = new THREE.Group();
  const mk = (w: number, cc: THREE.ColorRepresentation, k: number) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, n * 3, w, 5, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(cc).multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    g.add(m);
    return m.material as THREE.MeshBasicMaterial;
  };
  const outer = mk(thick * 2.6, col, inten * 0.45);
  const inner = mk(thick, 0xffffff, inten * 1.1);
  void c.sc.vfx.spawn(g, dur, (k) => {
    const flick = Math.random() > 0.2 ? 1 : 0.35;
    const a = (k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85) * flick;
    outer.opacity = a;
    inner.opacity = a;
  });
}

/** Forked lightning: a trunk plus a few short bolts branching outward */
function forked(c: UltCtx, from: THREE.Vector3, to: THREE.Vector3, col: THREE.ColorRepresentation, dur: number, thick: number, branches: number, inten = 1): void {
  zap(c, from, to, col, dur, thick, inten);
  const len = from.distanceTo(to);
  for (let i = 0; i < branches; i++) {
    const t = rand(0.2, 0.8);
    const p = from.clone().lerp(to, t);
    const end = p.clone().add(v3(rand(-1, 1), rand(-0.6, 0.1), rand(-1, 1)).normalize().multiplyScalar(len * rand(0.12, 0.28)));
    zap(c, p, end, col, dur * 0.7, thick * 0.5, inten * 0.8, 0.18);
  }
}

/** Heavenly bolt: strikes from the top of the Nine Heavens down the tunnel onto the opponent, redrawn once (the strobe feel of lightning) */
function judgment(c: UltCtx, i: number): void {
  const m = mem(c);
  const rings = m.rings;
  if (!rings) return;
  const top = rings.pos(TIERS - 1).add(v3(0, 1.5, 0));
  const to = c.sc.center(c.foe);
  const hot = i === 0 || m.n >= 2;
  const col = hot ? VOLT_HI : VOLT;
  const thick = 0.05 + i * 0.008 + m.n * 0.006;
  forked(c, jitter(top, 1.2), to, col, 0.16, thick, 3 + m.n, 1.1);
  void c.sc.tw.wait(0.04, 'fx').then(() => forked(c, jitter(top, 1.2), to, hot ? VOLT : LAV, 0.12, thick * 0.8, 2, 0.9));
  c.sc.vfx.emit({ pos: to, count: 18, color: [VOLT, VOLT_HI], speed: [2, 5], life: [0.2, 0.45], size: [0.06, 0.14], sizeEnd: 0.02, radius: 0.2, gravity: -2, drag: 2, intensity: 0.85 });
}

/** Material of the lightning skeleton: glowing edges (Fresnel) plus fine streaks of current sweeping along the body; only visible surfaces are drawn, so it comes out as a lightning outline around a black shadow */
function xrayMat(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(GOLD).multiplyScalar(1.3) }, uHi: { value: new THREE.Color(0xfff2b0).multiplyScalar(1.2) }, uT: { value: 0 }, uA: { value: 1 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uHi; uniform float uT; uniform float uA; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        // A thin bright gold edge (like the bone rim on an X-ray) with a slight halo outside; the inside of the body stays pure black, with only a sparse current sweeping across
        float edge = smoothstep(0.6, 0.78, f);
        float halo = pow(f, 6.0) * 0.35;
        float scan = smoothstep(0.975, 1.0, sin(vW.y * 12.0 - uT * 9.0 + vW.x * 2.0)) * f * 0.9;
        float a = (edge * 1.5 + halo + scan) * uA;
        gl_FragColor = vec4(mix(uCol, uHi, edge * 0.6) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** Compile the shader first (it must not hitch at the freeze moment) */
function prewarm(c: UltCtx, mat: THREE.Material): void {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.02), mat);
  m.frustumCulled = false;
  void c.sc.vfx.spawn(m, 0.1, () => m.position.copy(c.sc.stage.camera.position), () => m.geometry.dispose());
}

/** Lightning skeleton: a lightning outline of the opponent's whole body floating above the black shadow, with a very faint grid layered on, and small arcs constantly jumping on the skeleton (used for the freeze; the geometry is shared with the model and must not be disposed) */
function skeleton(c: UltCtx): FxLayer | undefined {
  const { sc, foe } = c;
  const cr = sc.slots[foe].creature;
  if (!cr) return undefined;
  const g = new THREE.Group();
  const xray = mem(c).xray ?? xrayMat();
  const lattice = new THREE.MeshBasicMaterial({ color: new THREE.Color(VOLT).multiplyScalar(0.9), wireframe: true, transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const src: THREE.Mesh[] = [];
  const copies: THREE.Mesh[] = [];
  const nodes: THREE.Vector3[] = [];
  cr.root.updateMatrixWorld(true);
  cr.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || (o as THREE.Sprite).isSprite) return;
    if (cr.outlines.includes(m.material as THREE.ShaderMaterial)) return;
    for (const mat of [xray, lattice]) {
      const w = new THREE.Mesh(m.geometry, mat);
      w.matrixAutoUpdate = false;
      w.matrix.copy(m.matrixWorld);
      w.renderOrder = 30;
      g.add(w);
      src.push(m);
      copies.push(w);
    }
    nodes.push(m.getWorldPosition(new THREE.Vector3()));
  });
  let acc = 0;
  return sc.vfx.layer(g, (dt, t) => {
    // Follows the model (during hit-stop the model only trembles slightly)
    for (let i = 0; i < copies.length; i++) copies[i].matrix.copy(src[i].matrixWorld);
    xray.uniforms.uT.value = t;
    xray.uniforms.uA.value = 0.8 + Math.random() * 0.2;
    acc += dt;
    if (acc > 0.05 && nodes.length > 1) {
      acc = 0;
      for (let k = 0; k < 2; k++) {
        const a = nodes[Math.floor(Math.random() * nodes.length)];
        const b = nodes[Math.floor(Math.random() * nodes.length)];
        if (a !== b) zap(c, a, b, VOLT_HI, 0.08, 0.01, 0.9, 0.25);
      }
    }
  }, () => lattice.dispose());
}

// ───────────────────────── Sound ─────────────────────────
// The dry thunder, whinny, heavenly bolt and rolling thunder are audio files generated by ElevenLabs (synthesized versions are used until they finish loading); the countdown beeps and ear ringing are always synthesized

/** Dry thunder: a close-range crack */
function crack(): void {
  playOr(crackUrl, () => {
    synth.noise({ type: 'highpass', f0: 3000, f1: 400, q: 0.7, dur: 0.22, gain: 0.5 });
    synth.noise({ type: 'lowpass', f0: 900, f1: 120, dur: 0.3, gain: 0.35 });
    synth.tone({ type: 'sine', f0: 90, f1: 40, dur: 0.3, gain: 0.3 });
  }, { gain: 0.8 });
}
/** Countdown electronic beeps: each one higher than the last */
function pip(i: number): void {
  synth.tone({ type: 'square', f0: 392 * Math.pow(2, i / 6), dur: 0.055, gain: 0.05 });
  synth.noise({ type: 'highpass', f0: 5000, dur: 0.03, gain: 0.07 });
  if (i >= 5) synth.tone({ type: 'sine', f0: 70, f1: 45, dur: 0.12, gain: 0.12 + (i - 5) * 0.03 });
}
/** Thunderclap: a late, long-trailing rolling thunder (at the moment time resumes) */
function rumble(): void {
  synth.tone({ type: 'sine', f0: 60, f1: 32, dur: 1.0, gain: 0.45 });
  playOr(rollUrl, () => {
    synth.noise({ type: 'lowpass', f0: 1400, f1: 60, dur: 1.4, gain: 0.7 });
    synth.noise({ type: 'bandpass', f0: 260, f1: 70, q: 1.5, dur: 1.2, gain: 0.4 });
    synth.tone({ type: 'sawtooth', f0: 48, f1: 30, dur: 0.8, gain: 0.08 });
  }, { gain: 0.9 });
}
/** Ear ringing in the freeze: everything goes quiet, leaving only a thin high-frequency tone and crackling current */
function tinnitus(dur: number): void {
  synth.tone({ type: 'sine', f0: 5200, f1: 5600, dur, gain: 0.035, attack: 0.02 });
  for (let i = 0; i < 6; i++) synth.noise({ type: 'bandpass', f0: 2500 + Math.random() * 3000, q: 8, dur: 0.04, gain: 0.08, delay: Math.random() * dur * 0.9 });
}

// ───────────────────────── Framing ─────────────────────────

/** Signature shot: looking up at the tunnel of nine thunder rings from the opponent's feet */
function shotUp(c: UltCtx): Shot {
  const { sc, cine, side, foe } = c;
  const hf = heightOf(c, foe);
  const base = sc.slots[foe].home.clone();
  const top = mem(c).rings?.pos(TIERS - 1) ?? base.clone().add(v3(0, 12, 0));
  // The camera hugs the ground, slightly toward the audience side: the lowest ring and the topmost ring have about the same apparent size, so the nine rings stack into one tunnel
  const pos = cine.orbitPos(side, base, 75, hf * 0.8 + 1.6, 0.4);
  return [pos, top.add(v3(0, 1.5, 0)), sc.portrait ? 1.4 : 1.25];
}
/** Horn close-up: low angle, close in, the horn tip at the top edge of the frame */
function shotHorn(c: UltCtx): Shot {
  const { sc, cine, side } = c;
  const h = heightOf(c, side);
  const head = sc.head(side);
  return [cine.orbitPos(side, head, 45, h * 0.6 + 0.75, -h * 0.04), head.clone().add(v3(0, h * 0.12, 0)), 0.85];
}
/**
 * The opponent's face: lightning flickers across it. The camera is between the opponent and the qilin, toward the audience side (145°), facing the face;
 * placed behind the opponent (35°) it would only catch the back of the head, and for a long opponent like the whale the whole frame would be back
 */
function shotFoe(c: UltCtx): Shot {
  const { sc, cine, side, foe } = c;
  const hf = heightOf(c, foe);
  const long = Math.max(0, (sc.slots[foe].creature?.width ?? 0) * 0.8 - hf);
  const head = sc.head(foe);
  return [cine.orbitPos(side, head, 145, hf * 0.9 + long * 0.6 + 1.2, -hf * 0.02), head, 0.9];
}
/** Wide shot: the rings standing above the opponent's head can be seen (portrait mode switches to over-the-shoulder) */
function shotWide(c: UltCtx): Shot {
  const { sc, cine, side, foe } = c;
  const hc = heightOf(c, side);
  const home = sc.slots[side].home;
  const fh = sc.slots[foe].home;
  if (sc.portrait) return [cine.orbitPos(side, sc.center(side), 160, hc * 1.2 + 3.8, hc * 0.9 + 1.0), fh.clone().add(v3(0, 5.0, 0)), 1.35];
  const mid = home.clone().lerp(fh, 0.7);
  const span = home.distanceTo(fh);
  return [cine.orbitPos(side, mid, 95, span * 0.7 + 7, 0.9), mid.add(v3(0, 4.8, 0)), 1.3];
}
/** Judgment: pulled back and widened, the opponent small at the bottom of the frame, the pillars of the Nine Heavens pressing down on its head */
function shotJudge(c: UltCtx): Shot {
  const { sc, cine, side, foe } = c;
  const hf = heightOf(c, foe);
  const base = sc.slots[foe].home.clone();
  return [cine.orbitPos(side, base, 55, hf * 1.2 + 9.5, hf * 0.3 + 0.5), base.add(v3(0, hf * 0.5 + 4.2, 0)), 1.4];
}

/** Hard cut: cut straight into place, the zoom cuts with it, then pushes in slightly over dur seconds (so it is never a dead frame) */
function hardCut(c: UltCtx, [pos, look, fov]: Shot, dur: number, push = 0.05): void {
  const { cine } = c;
  cine.cut(pos, look);
  void cine.look({ fov }, 0);
  if (dur > 0) void cine.shot(pos.clone().lerp(look, push), look, dur, ease.linear);
}

// ───────────────────────── Cinematic ─────────────────────────

/** Dark sky: a dry thunderclap, the sky pressed to deep indigo, the nine rings emerge from bottom to top above the opponent's head */
async function darken(c: UltCtx): Promise<void> {
  const { sc, cine, side } = c;
  const m = mem(c);
  m.n = charges(c);
  c.ui.cutin(side, c.who, c.skill.name, c.el, true);
  preloadSamples(...FILES);
  synth.dropMusic();
  crack();
  sky(c, 0.3);
  void cine.look({ letterbox: 1, desat: 0.5, vignette: 0.8, lift: INDIGO, tint: 0xd8d0ff, bloom: 0.7, grain: 0.12 }, 0.25, ease.outQuad);
  cine.track(() => sc.center(side), ['vig']);
  hardCut(c, shotWide(c), 0.6, 0.06);
  sc.rig.addTrauma(0.25);
  brighten(c, 1);
  m.orbs = makeOrbs(c, m.n);
  const rings = (m.rings = makeRings(c));
  m.xray = xrayMat();
  prewarm(c, m.xray);
  // The sky's reply: a bolt strikes from high up right above the opponent's head, and the nine rings rise from there
  const fh = sc.slots[c.foe].home.clone();
  const hf = heightOf(c, c.foe);
  zap(c, fh.clone().add(v3(rand(-6, 6), 30, rand(-6, 6))), fh.clone().add(v3(0, hf * 1.1 + 1.5, 0)), LAV, 0.22, 0.09, 0.9, 0.08);
  void sc.windup(side, 0.3);
  synth.tone({ type: 'sawtooth', f0: 90, f1: 260, dur: 0.5, gain: 0.06, attack: 0.05 });
  for (let i = 0; i < TIERS; i++) {
    void sc.tw.wait(0.1 + i * 0.04, 'world').then(() => {
      rings.reveal(i);
      synth.tone({ type: 'triangle', f0: 600 + i * 90, dur: 0.06, gain: 0.03 });
    });
  }
  await c.wait(0.55);
}

/** Nine Heavens countdown: the rings light up one by one from nine to one, counting faster and faster, with hard cuts on screen */
async function countdown(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const shots = [shotUp, shotHorn, shotFoe, shotUp, shotWide, shotHorn, shotUp, shotFoe, shotHorn];
  const focus = [foe, side, foe, foe, side, side, foe, foe, side] as const;
  const gaps = [0.22, 0.19, 0.16, 0.14, 0.12, 0.1, 0.09, 0.08, 0.07];
  for (let i = 0; i < TIERS; i++) {
    m.rings?.light(TIERS - 1 - i);
    sky(c, 0.05 + i * 0.015);
    pip(i);
    if (m.orbs) m.orbs.speed = 4 + i * 1.6;
    const f = focus[i];
    cine.track(() => sc.center(f), ['vig']);
    hardCut(c, shots[i](c), gaps[i]);
    if (i >= 6) sc.rig.addTrauma(0.12);
    await c.wait(gaps[i]);
  }
  // The beat after "one" lights up: hold on the horn close-up and slowly push in, with only lightning in its eyes (the director then settles the charge, and this pause is exactly the gathering before the sprint)
  const [p, l] = shotHorn(c);
  void cine.shot(p.clone().lerp(l, 0.22), l.clone().add(v3(0, -heightOf(c, side) * 0.04, 0)), 0.6, ease.inQuad);
  eyeGlint(c, VOLT_HI, 0.6);
  synth.tone({ type: 'sine', f0: 1568, dur: 0.4, gain: 0.05 });
  synth.tone({ type: 'sawtooth', f0: 120, f1: 900, dur: 0.5, gain: 0.05, attack: 0.3 });
  if (m.orbs) m.orbs.speed = 22;
  void cine.look({ desat: 0.7 }, 0.12);
  await c.wait(0.05);
}

/** Thunder step → call to heaven → judgment */
async function strike(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const hc = heightOf(c, side);
  const hf = heightOf(c, foe);
  const home = sc.slots[side].home.clone();
  const fh = sc.slots[foe].home.clone();
  const fwd = cine.forward(side);
  const cr = sc.slots[side].creature;

  // ① Electric light under the hooves: a low-angle view of the hooves, a ring of electric light bursts out, and the qilin is no longer where it stood
  const hoof = home.clone().setY(0.05);
  hardCut(c, [cine.orbitPos(side, hoof, 60, hc * 0.7 + 0.9, hc * 0.22), hoof.clone().add(v3(0, hc * 0.12, 0)), 1], 0.08);
  void cine.look({ desat: 0.5 }, 0.1);
  void sc.vfx.ring(hoof.clone().setY(0.08), VOLT, 0.1, hc * 0.9, 0.3);
  sc.vfx.emit({ pos: hoof, count: 24, color: [VOLT, VOLT_HI, LAV], speed: [1, 3], dir: UP, spread: 0.8, life: [0.2, 0.4], size: [0.04, 0.1], sizeEnd: 0.01, radius: hc * 0.2, gravity: 4, drag: 1.5, intensity: 0.85 });
  if (cr) void sc.vfx.ghost(cr.root, VOLT, 0.35, 0.7);
  void sc.lunge(side, 0.14);
  synth.noise({ type: 'highpass', f0: 2000, f1: 6000, dur: 0.1, gain: 0.3 });
  synth.tone({ type: 'square', f0: 220, f1: 1400, dur: 0.12, gain: 0.06 });
  await c.wait(0.08);

  // ② The qilin's point of view: the camera itself is that bolt, rushing from where it stood to the opponent in 0.12 s, the world lunging at the camera
  const span = home.distanceTo(fh);
  // Starting at the original spot, at the horn's height (on the legacy model the horn is at about 80% of body height; on the new model the horn is higher, so the height of the hornTip anchor is used,
  // so the camera clears the top of the head to see the opponent and the frame is not filled by the mane rushing forward)
  const tip = anchorPos(c, 'hornTip');
  const eyeY = tip && cr ? tip.y - cr.root.position.y + hc * 0.06 : hc * 0.8;
  const eye0 = home.clone().add(v3(0, eyeY, 0)).addScaledVector(fwd, hc * 0.3);
  const eye1 = cine.orbitPos(side, fh.clone().addScaledVector(fwd, -hf * 1.1 - 1.2), 90, hc * 0.45, hc * 0.75);
  const aim = sc.center(foe);
  cine.cut(eye0, aim);
  void cine.look({ fov: 1.25 }, 0);
  void cine.shot(eye1, aim, 0.12, ease.inQuad);
  for (let i = 0; i < 5; i++) sc.vfx.emit({ pos: home.clone().lerp(fh, 0.15 + i * 0.15).add(v3(0, hc * 0.4, 0)), count: 6, color: [VOLT, BOLT], speed: [0.5, 1.5], life: [0.15, 0.3], size: [0.04, 0.08], sizeEnd: 0.01, drag: 2, intensity: 0.8 });
  cine.track(() => sc.center(foe), ['radial']);
  void cine.pulse({ radial: 1.2, lines: 0.6, linesColor: VOLT }, { radial: 0, lines: 0 }, 0.2);
  sfx.whooshBig();
  void sc.vfx.streak(home.clone().add(v3(0, hc * 0.45, 0)), fh.clone().addScaledVector(fwd, -hf * 0.7).add(v3(0, hc * 0.45, 0)), VOLT, 0.05, span * 0.6, 0.2);
  await c.wait(0.12);

  // ③ In front of the opponent: low angle, horn raised high; all the thunder orbs pulled into the horn tip
  hardCut(c, shotHorn(c), 0.16, 0.08);
  cine.track(() => hornTip(c), ['vig']);
  if (m.orbs) void sc.tw.to(0.14, (k) => (m.orbs!.gather = k), ease.inQuad, 'fx');
  cr?.setFlash(VOLT_HI, 0.35);
  // At the moment the horn is raised, the qilin whinnies (the new model throws its head back with the rear weight; the legacy model lifts its head through the attack pose)
  const act = actOf(c);
  if (act) void sc.tw.to(0.12, (k) => (act.rear = Math.max(act.rear ?? 0, k)), ease.outQuad, 'fx');
  playSample(neighUrl, { gain: 0.6 });
  synth.tone({ type: 'sawtooth', f0: 180, f1: 1800, dur: 0.28, gain: 0.07, attack: 0.05 });
  synth.noise({ type: 'bandpass', f0: 800, f1: 4000, q: 2, dur: 0.25, gain: 0.2 });
  await c.wait(0.16);

  // ④ Call to heaven: cut to a fixed, widened shot (one "pause" after the quick cuts), a bolt rises from the horn tip straight up the Nine Heavens, passing through the rings one by one
  hardCut(c, shotJudge(c), 0.75, 0.05);
  cine.track(() => sc.center(foe), ['radial', 'vig']);
  m.orbs?.burst();
  m.orbs?.kill();
  m.orbs = undefined;
  const rings = m.rings;
  if (rings) {
    rings.crackle = false;
    forked(c, hornTip(c), rings.pos(0), VOLT_HI, 0.26, 0.04, 2, 1.1);
    rings.flare(0);
    synth.tone({ type: 'sawtooth', f0: 300, f1: 2600, dur: 0.3, gain: 0.08 });
    synth.noise({ type: 'highpass', f0: 1500, f1: 9000, dur: 0.3, gain: 0.25 });
    for (let i = 0; i < TIERS - 1; i++) {
      void sc.tw.wait(0.026 * (i + 1), 'world').then(() => {
        zap(c, jitter(rings.pos(i), 0.4), jitter(rings.pos(i + 1), 0.4), i % 2 ? VOLT : VOLT_HI, 0.2, 0.035, 1, 0.2);
        rings.flare(i + 1);
      });
    }
  }
  await c.wait(0.24);
  sky(c, 0.22);
  await c.wait(0.05);

  // ⑤ Judgment: same shot, the nine rings blaze from top to bottom, heavenly bolts strike down
  void cine.pulse({ radial: 0.9 }, { radial: 0.15 }, 0.35);
  ultSfx.swell(0.24, 0.35);
  for (let i = TIERS - 1; i >= 0; i--) {
    void sc.tw.wait(0.02 * (TIERS - 1 - i), 'world').then(() => {
      rings?.flare(i, 1);
      sky(c, 0.08);
    });
  }
  await c.wait(0.17);
  // 1 + charge heavenly bolts strike in succession, and the last one lands at the moment of impact
  for (let i = 0; i <= m.n; i++) {
    if (i === 0) m.strike = playSample(strikeUrl, { gain: 0.75 });
    judgment(c, i);
    sky(c, 0.3);
    if (i < m.n) await c.wait(0.045);
  }
  await c.wait(0.02);
}

/** Awe: one frame of inverted color, time freezes, the world fades to black and white, the opponent becomes a black shadow with a lightning skeleton floating on it; then a thunderclap, and time resumes */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe, side } = c;
  const m = mem(c);
  const spd = sc.tw.speed || 1;
  const fh = heightOf(c, foe);
  const base = sc.slots[foe].home.clone();
  if (ev.hitIndex < ev.hits) return;

  // Freeze: first one frame of inverted color in the wide shot (a camera flash), wait for the shared hit flash to burn out, then hard cut into a black-and-white lightning skeleton close-up
  // (the tween's real clock itself is multiplied by battle speed; only the hit-stop's milliseconds have to be divided by hand)
  const flashHold = 0.3;
  const still = 0.5;
  const freeze = flashHold + still;
  cine.invertFlash(0.05);
  sc.stage.hitStop((freeze / spd) * 1000);
  sc.stage.chromatic(1.2);
  void cine.look({ radial: 0, lines: 0, bloom: 0.5 }, 0.1);
  // The shared hit cinematic's flash sprites cannot finish burning in slow motion, and the freeze close-up would be covered by them: only the heavenly bolt itself is kept
  const fc0 = sc.center(foe);
  for (const o of sc.vfx.group.children) {
    if ((o as THREE.Points).isPoints) continue;
    if (((o as THREE.Sprite).isSprite || (o as THREE.Mesh).isMesh) && o.position.distanceTo(fc0) < fh) o.visible = false;
  }
  m.frozen = true;
  synth.duck(-40, 60);
  // The heavenly bolt's sound is cut at the freeze frame: the whole world goes quiet, leaving only the ear ringing
  m.strike?.fade(0.06);
  m.strike = null;
  const fc = sc.slots[foe].creature;
  void sc.tw.wait(flashHold, 'real').then(() => {
    if (!m.frozen) return;
    void cine.look({ desat: 0.9, isolate: 1, lift: 0x000000, tint: 0xffffff, vignette: 0.9, grain: 0.35, bloom: 0.3, radial: 0, lines: 0, letterbox: 1 }, 0);
    // Pure black silhouette: the hit flash is pressed to black, and the glowing parts are all pressed to black too
    fc?.setFlash(0x000000, 1);
    if (fc && !m.foeGlows) {
      m.foeGlows = { mats: [...fc.glows], orig: fc.glows.map((g) => g.color.clone()) };
      for (const g of m.foeGlows.mats) g.color.setScalar(0);
      if (fc.lab) {
        m.foeHidden = [];
        fc.root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh || !mesh.visible) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          if (mats.some((x) => !(x as SpiritMaterial).isSpiritMaterial)) m.foeHidden!.push(mesh);
        });
        for (const o of m.foeHidden) o.visible = false;
      }
    }
    m.foeDark = true;
    m.skel?.kill();
    m.skel = skeleton(c);
    const center = sc.center(foe);
    // The shared hit cinematic's thick bolt (white core) is still hanging over the opponent's head in slow motion and would be a big white slab in the close-up: at this moment only the skeleton and arcs are kept
    for (const o of sc.vfx.group.children) {
      const kids = o.children;
      if (!(o as THREE.Group).isGroup || !kids.length) continue;
      if (kids.every((k) => (k as THREE.Mesh).isMesh && ((k as THREE.Mesh).geometry as THREE.TubeGeometry).type === 'TubeGeometry')) o.visible = false;
    }
    // Fit the whole opponent into the frame, with a little breathing room (pulled back further in portrait)
    const size = Math.max(fh, fc?.width ?? fh);
    const p0 = cine.orbitPos(side, center, 45, (size * 1.5 + 2.4) * (sc.portrait ? 1.35 : 1), fh * 0.25);
    const look = center.clone();
    const p1 = p0.clone().lerp(look, 0.08);
    cine.cut(p0, look);
    void cine.look({ fov: 1, roll: 0.04 }, 0);
    let ht = 0;
    m.camHold?.kill();
    m.camHold = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      ht += dt;
      sc.rig.claim();
      sc.rig.pos.lerpVectors(p0, p1, ease.inQuad(Math.min(1, ht / still)));
      sc.rig.look.copy(look);
    });
    cine.track(() => sc.center(foe), ['vig']);
    tinnitus(still);
    synth.noise({ type: 'highpass', f0: 6000, dur: 0.03, gain: 0.12 });
  });

  // Time resumes: thunderclap, the skeleton scatters into sparks, color returns, the nine rings collapse from top to bottom
  void sc.tw.wait(freeze, 'real').then(() => {
    if (!m.frozen) return;
    m.frozen = false;
    m.skel?.kill();
    m.skel = undefined;
    m.camHold?.kill();
    m.camHold = undefined;
    unblack(c);
    fc?.setFlash(VOLT, 0.25);
    m.foeDark = false;
    // The qilin lowers its raised head
    const act = actOf(c);
    if (act?.rear) {
      const r0 = act.rear;
      void sc.tw.to(0.5, (k) => (act.rear = r0 * (1 - k)), ease.inOutQuad, 'fx');
    }
    rumble();
    sfx.impactBig();
    sc.rig.addTrauma(0.9);
    sc.stage.chromatic(1);
    sky(c, 0.8);
    cine.shock(sc.center(foe), 1.3, 0.7, 1.2);
    void cine.look({ roll: 0 }, 0.3);
    sc.vfx.emit({ pos: sc.center(foe), count: 90, color: [VOLT, VOLT_HI, LAV], speed: [2, 7], life: [0.4, 0.9], size: [0.05, 0.14], sizeEnd: 0.02, radius: fh * 0.4, gravity: 5, drag: 1.2, intensity: 0.9 });
    void sc.vfx.ring(sc.center(foe), VOLT, 0.2, fh * 1.1, 0.3, sc.stage.camera.position.clone().sub(sc.center(foe)));
    void sc.vfx.decal(base.clone().setY(0.05), crackTex(5), VOLT, fh * 1.4 + 3.5, 2.4, Math.random() * 6.28, 0.9);
    void sc.vfx.ring(base.clone().setY(0.1), VOLT, 0.3, fh * 2 + 4, 0.5);
    m.rings?.collapse(TIERS - 1, -1, 0.035);
    settle(c, 0.55, 0.3);
  });
}

/** Guarded: the heavenly bolt strikes the barrier, the nine rings shatter one after another starting from the lowest; the barrier finally holds */
async function guarded(c: UltCtx): Promise<void> {
  const m = mem(c);
  for (let i = 1; i <= m.n; i++) void c.sc.tw.wait(i * 0.05, 'fx').then(() => judgment(c, i));
  m.rings?.collapse(0, 1, 0.05);
  sky(c, 0.5);
  await ultGuarded(c);
}

/** Put the opponent's glowing parts back to their original color, and bring back the hidden parts */
function unblack(c: UltCtx): void {
  const m = mem(c);
  for (const o of m.foeHidden ?? []) o.visible = true;
  m.foeHidden = undefined;
  const g = m.foeGlows;
  if (!g) return;
  g.mats.forEach((x, i) => x.color.copy(g.orig[i]));
  m.foeGlows = undefined;
}

async function after(c: UltCtx): Promise<void> {
  const { sc, foe } = c;
  const m = mem(c);
  m.frozen = false;
  unblack(c);
  m.skel?.kill();
  m.skel = undefined;
  m.camHold?.kill();
  m.camHold = undefined;
  m.orbs?.kill();
  m.orbs = undefined;
  if (m.foeDark) {
    sc.slots[foe].creature?.setFlash(VOLT, 0);
    m.foeDark = false;
  }
  // Thunder markings return to the original color (new model: charge and rear weights back to 0), the thunder rings go out
  const g = m.glows;
  const act = actOf(c);
  const a0 = { charge: act?.charge ?? 0, rear: act?.rear ?? 0 };
  if (g || a0.charge || a0.rear) {
    const from = g?.mats.map((x) => x.color.clone()) ?? [];
    await sc.tw.to(0.4, (k) => {
      g?.mats.forEach((x, j) => x.color.lerpColors(from[j], g.orig[j], k));
      if (act) {
        act.charge = a0.charge * (1 - k);
        act.rear = a0.rear * (1 - k);
      }
    }, ease.inOutQuad, 'fx');
  }
  if (act) act.charge = act.rear = 0;
  m.rings?.kill();
  m.rings = undefined;
  m.xray?.dispose();
  m.xray = undefined;
  const u = sc.arena.skyMat?.uniforms.uFlash;
  if (u) u.value = Math.max(0, u.value - m.skyPrev);
  m.sky = m.skyPrev = 0;
}

export default defineSsr({
  async windup(c) {
    await darken(c);
    await countdown(c);
  },
  deliver: strike,
  impact,
  guarded,
  after,
});
