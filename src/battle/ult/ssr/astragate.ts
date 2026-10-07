// Astra, Warden of the Star Gate: "Gate of Stars"
//
// What this cinematic is about: the gatekeeper never takes a step from its post. For the first time in its life it opens the Star Gate behind itself, and what lies beyond is not an enemy
// but everything it has blocked and sealed away all along (starlight and sealed moves), all of it pouring over its head onto the opponent.
// Model: a stone lion sitting before the gate; the arched stone mane framing its face is a small star gate. The great star gate that rises behind it is concentric with the mane, the small gate nested inside the large one.
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed)
//   windup
//     0.00  Announcement: letterbox, sky pressed to deep indigo; camera at a low angle right in front of the face (audience side 28°), half-lowered stone eyelids
//     0.15  Eyes open: the eyelids lift all at once (act.wake), eye glints in both eyes, one clear "ching"
//     0.35  The starlight stones light up (act.glow): chest, keystone, the star veil in the gate opening; the keystone on the forehead flashes
//     0.60  The camera slowly pulls back and up to the full body; the ground behind it cracks, and eight arch stones rise from underground one by one, building a stone ring taller than it is (a dull thud for each stone, the gatekeeper unmoved)
//     1.62  The keystone falls from the sky and sets into the top of the ring: the gold rings light up and the rune stones orbit; at the same moment the keystone on its forehead flashes in answer
//     1.95  Roar: mouth open, head thrown back (act.roar), starlight showing in its mouth; the gate veil behind it opens outward from the center into a sea of stars, and the sealed moves float in the gate as locked rune seals
//     2.55  End (the camera pushes in to above the chest, the sea of stars backlighting it from behind)
//   deliver
//     0.00  Floodgate: the camera cuts to below the top of the gate looking up, and the river of stars bursts out of the gate and over the gatekeeper's head (the head of the river reaches the opponent in 0.5 s)
//     0.30  Cut to the target's view: audience side, low angle behind the opponent, the gatekeeper sitting before the great star gate in the distance, the river of stars surging toward the camera and the opponent, the seals flowing downstream
//     0.85  The moment before impact (handed to the director to play the impact)
//   impact: the river of stars hits the opponent, gold flash, the star chart connects stroke by stroke under the arch, the locked seals shatter, the ground cracks; the camera pulls back to a side wide shot (gate, river and opponent in one frame)
//   guarded: the river of stars hits the barrier and the gate veil slams shut; the gatekeeper closes its mouth, still glaring at the opponent
//   after: mouth closes, eyelids drop back to half-open; the gate veil draws in and the arch stones sink back underground one by one; the gatekeeper never leaves its place from start to finish

import * as THREE from 'three';
import { playOr, preloadSamples } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import crumbleUrl from '../../../audio/sfx/astragate-crumble.mp3';
import gateUrl from '../../../audio/sfx/astragate-gate.mp3';
import punchUrl from '../../../audio/sfx/astragate-punch.mp3';
import roarUrl from '../../../audio/sfx/astragate-roar.mp3';
import stoneUrl from '../../../audio/sfx/astragate-stone.mp3';
import warpUrl from '../../../audio/sfx/astragate-warp.mp3';
import { crackTex, starTex } from '../../../render/fxtex.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { sceneMaterial } from '../../../render/spiritToon.ts';
import { glowTex, runeCircleTex } from '../../../render/textures.ts';
import { ease } from '../../../render/tween.ts';
import type { FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, eyeGlint } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [stoneUrl, gateUrl, roarUrl, warpUrl, punchUrl, crumbleUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const STONE = 0xd8d4c8;
const STONE_DK = 0xb9b3a4;
const GOLD = 0xe6c264;
const GOLD_HI = 0xfff1c4;
const CORE = 0x8fd8ff;
const CORE_HI = 0xe0f6ff;
const UP = new THREE.Vector3(0, 1, 0);
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};

interface Stone {
  m: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  spin: THREE.Vector3;
  /** 0 = still underground (or in the sky), 1 = built into place */
  k: number;
}
interface Gate {
  root: THREE.Group;
  /** Gate center (world coordinates) */
  pos: THREE.Vector3;
  r: number;
  stones: Stone[];
  curtain: THREE.ShaderMaterial;
  set(open: number, glow: number): void;
  /** The seals floating in the gate (the sealed moves), appearing when the gate opens */
  seals: THREE.Sprite[];
  kill(): void;
}
interface Mem {
  /** Starlight (% of max HP, 0 to 40) */
  pct: number;
  /** Names of the opponent's sealed skills */
  sealed: string[];
  gate?: Gate;
  layers: FxLayer[];
}
const mem = (c: UltCtx): Mem => (c.mem.ast ??= { pct: 0, sealed: [], layers: [] }) as Mem;

/** Read the mechanic state: the starlight % on its body, the opponent's sealed skills */
function readState(c: UltCtx): void {
  const m = mem(c);
  const me = c.view.sides[c.side];
  const fv = c.view.sides[c.foe];
  m.pct = me.team[me.active]?.marks.find((x) => x.id === 'kit:ast_star')?.n ?? 0;
  m.sealed = fv.team[fv.active]?.marks.filter((x) => x.id === 'disabled').map((x) => x.note ?? '') ?? [];
}

/** Amount of starlight (0 to 1): 40% is the cap */
const starAmt = (c: UltCtx): number => Math.min(1, mem(c).pct / 40);

/** The gatekeeper's action weights (only effective on the experimental model) */
const act = (c: UltCtx): Record<string, number> => c.sc.slots[c.side].creature?.act ?? {};

/** World position of an anchor; use fallback when the legacy model has no such anchor */
function anchorPos(c: UltCtx, name: string, fallback: () => THREE.Vector3): THREE.Vector3 {
  const cr = c.sc.slots[c.side].creature;
  const a = cr?.anchor(name);
  if (!cr || !a) return fallback();
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}

// ───────────────────────── Sound ─────────────────────────
// The stones, gate opening, roar, the floodgate rush and the sinking back underground are audio files generated by ElevenLabs (synthesized versions are used until they finish loading); the bell is always synthesized

/** The dull thud of a stone landing (the lower the pitch, the bigger the stone; the audio file uses playback speed) */
function thud(gain = 0.35, pitch = 1): void {
  synth.tone({ type: 'sine', f0: 95 * pitch, f1: 36, dur: 0.32, gain });
  playOr(stoneUrl, () => synth.noise({ type: 'lowpass', f0: 700, f1: 110, dur: 0.28, gain: gain * 0.7 }), { gain: gain * 2.4, rate: pitch });
}

/** Light-element bell: a chord, rising slowly */
function bells(root = 523.25, gain = 0.07, attack = 0.02, dur = 1.4): void {
  for (const [ratio, d] of [[1, 0], [1.25, 0.04], [1.5, 0.08], [2, 0.12]] as const) {
    synth.tone({ type: 'sine', f0: root * ratio, dur, gain, attack, delay: d });
    synth.tone({ type: 'triangle', f0: root * ratio * 2, dur: dur * 0.5, gain: gain * 0.25, attack, delay: d });
  }
}

/** Floodgate: a Star Gate howl that grows stronger as it rushes, the strongest moment landing as the river of stars hits the opponent (the audio file is a fading fly-by played in reverse); the synthesized version is a rising sweep */
function warp(dur: number): void {
  playOr(warpUrl, () => {
    synth.tone({ type: 'sawtooth', f0: 70, f1: 520, dur, gain: 0.09, attack: dur * 0.5 });
    synth.tone({ type: 'sawtooth', f0: 72, f1: 530, dur, gain: 0.07, attack: dur * 0.5, detune: 9 });
    synth.noise({ type: 'bandpass', f0: 250, f1: 3200, q: 1.4, dur, gain: 0.3, attack: dur * 0.6 });
  }, { gain: 0.7, endIn: dur });
  synth.tone({ type: 'sine', f0: 48, f1: 30, dur, gain: 0.3, attack: 0.05 });
}

/** Starlight pouring: a string of high arpeggio notes climbing upward */
function cascadeSfx(n: number): void {
  const notes = [1046.5, 1318.5, 1568, 2093, 2637, 3136, 3951];
  for (let i = 0; i < n; i++) synth.tone({ type: 'triangle', f0: notes[i % notes.length] * (1 + Math.floor(i / notes.length) * 0.5), dur: 0.5, gain: 0.05, delay: i * 0.045 });
  synth.noise({ type: 'highpass', f0: 4000, f1: 8000, dur: 0.5, gain: 0.1, attack: 0.1 });
}

// ───────────────────────── Gate veil ─────────────────────────

/** Gate veil: a round gate door leading to a sea of stars, with a deep indigo night sky inside, slowly turning nebulae and star points; on opening it parts outward from the center, with a ring of gold light at the edge */
function curtainMaterial(density: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uOpen: { value: 0 }, uGlow: { value: 0 }, uDensity: { value: density } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uT; uniform float uOpen; uniform float uGlow; uniform float uDensity; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float iris = smoothstep(uOpen + 0.02, uOpen - 0.05, r);
        float edge = exp(-abs(r - uOpen) * 32.0) * smoothstep(0.08, 0.45, uOpen);
        if (iris + edge < 0.002) discard;
        float ang = uT * 0.1;
        vec2 q = vec2(p.x * cos(ang) - p.y * sin(ang), p.x * sin(ang) + p.y * cos(ang));
        // Nebula: two slowly drifting layers of ripples, bright at the center and dark at the edges
        float neb = 0.5 + 0.5 * sin(q.x * 3.1 + uT * 0.3) * sin(q.y * 2.7 - uT * 0.23);
        vec3 col = mix(vec3(0.015, 0.02, 0.10), vec3(0.08, 0.13, 0.38), neb * (1.0 - r * 0.55));
        // A slanting golden river of stars
        float band = pow(max(0.0, 1.0 - abs(q.y * 1.7 + 0.25 * sin(q.x * 2.3 + uT * 0.2))), 3.0);
        col += vec3(0.42, 0.30, 0.12) * band * (0.35 + 0.65 * uDensity);
        // Stars: two layers of grid stars at different densities
        float s = 0.0;
        for (int i = 0; i < 2; i++) {
          float sc = i == 0 ? 20.0 : 38.0;
          vec2 g = q * sc; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
          vec2 off = (vec2(hash(id + 1.3), hash(id + 7.1)) - 0.5) * 0.8;
          float d = length(f - off);
          float b = hash(id + 3.7);
          float thr = i == 0 ? 0.88 - 0.3 * uDensity : 0.8 - 0.2 * uDensity;
          float star = step(thr, b) * exp(-d * d * (i == 0 ? 70.0 : 120.0));
          star *= 0.55 + 0.45 * sin(uT * (2.0 + b * 5.0) + b * 40.0);
          s += star * (i == 0 ? 1.0 : 0.6);
        }
        col += mix(vec3(1.0, 0.96, 0.85), vec3(0.7, 0.85, 1.0), hash(floor(q * 20.0))) * s * 1.5;
        col = mix(col, vec3(1.0, 0.94, 0.75), uGlow * 0.6);
        vec3 rim = vec3(1.0, 0.85, 0.5) * edge * 1.0;
        gl_FragColor = vec4(col * iris + rim, clamp(iris + edge, 0.0, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

// ───────────────────────── Star Gate ─────────────────────────

/** Stone: the scene's cartoon material, going through the post-processing outline for scene objects (thinner than the spirits', so the spirits' outlines remain the heaviest) */
function stoneMesh(geo: THREE.BufferGeometry, col: THREE.ColorRepresentation): THREE.Mesh {
  const m = new THREE.Mesh(geo, sceneMaterial(col, { rim: 0.35 }));
  m.layers.enable(INK_LAYER);
  m.userData.inkScene = true;
  return m;
}

/**
 * The great star gate behind the gatekeeper: stone ring, eight arch stones and a keystone, two gold rings on the inner edge, the gate veil, five orbiting rune stones outside, and the locked seals in the gate.
 * The arch stones start buried underground and the keystone in the sky, and are tweened into place by stones[i].k; at wrap-up k tweens back to 0 and the whole gate sinks back underground.
 */
function makeGate(c: UltCtx, pos: THREE.Vector3, r: number, fwd: THREE.Vector3): Gate {
  const { sc } = c;
  const m = mem(c);
  const root = new THREE.Group();
  root.position.copy(pos);
  root.lookAt(pos.clone().add(fwd));
  const stones: Stone[] = [];
  const addStone = (o: THREE.Object3D, to: THREE.Vector3, from: THREE.Vector3) => {
    o.position.copy(from);
    root.add(o);
    stones.push({ m: o, from, to, spin: new THREE.Vector3(hash(stones.length * 3) - 0.5, hash(stones.length * 5) - 0.5, hash(stones.length * 7) - 0.5).multiplyScalar(3), k: 0 });
  };
  // The stone ring itself: split into eight arcs, rising from underground along with the arch stones
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const arc = stoneMesh(new THREE.TorusGeometry(r, r * 0.065, 8, 10, Math.PI / 4), i % 2 ? STONE : STONE_DK);
    arc.rotation.z = a0 - Math.PI / 8;
    const g = new THREE.Group();
    g.add(arc);
    const blk = stoneMesh(new THREE.BoxGeometry(r * 0.2, r * 0.3, r * 0.19), i % 2 ? STONE : STONE_DK);
    blk.position.set(Math.cos(a0) * r, Math.sin(a0) * r, 0);
    blk.rotation.z = a0;
    const vein = new THREE.Mesh(new THREE.BoxGeometry(r * 0.02, r * 0.16, r * 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.5), toneMapped: false }));
    vein.position.set(r * 0.03, 0, r * 0.1);
    blk.add(vein);
    g.add(blk);
    // They rise from the ground directly below (shifted slightly outward) rather than flying in from all sides: the gate grows out of the earth beneath the gatekeeper
    const dir = new THREE.Vector3(Math.cos(a0), Math.sin(a0), 0);
    const from = new THREE.Vector3(dir.x * r * (0.25 + hash(i) * 0.3), -pos.y - r * (1.1 + hash(i + 11) * 0.5), (hash(i + 23) - 0.5) * 0.6);
    addStone(g, new THREE.Vector3(0, 0, 0), from);
  }
  // Keystone: falls from the sky, set with a starlight stone
  const key = new THREE.Group();
  key.add(stoneMesh(new THREE.BoxGeometry(r * 0.34, r * 0.26, r * 0.22), STONE));
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.07, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(CORE_HI).multiplyScalar(2.2), toneMapped: false }));
  gem.position.set(0, 0, r * 0.12);
  key.add(gem);
  const gemGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(CORE).multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  gemGlow.scale.setScalar(r * 0.36);
  gemGlow.position.set(0, 0, r * 0.14);
  key.add(gemGlow);
  addStone(key, new THREE.Vector3(0, r + r * 0.04, 0), new THREE.Vector3(0, r * 4.5, 0));

  // Gold rings (one in front, one behind): lit only after the keystone is in place
  const rims: THREE.Mesh[] = [];
  for (const z of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, r * 0.022, 8, 72), new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.15), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    rim.position.z = z * r * 0.06;
    rims.push(rim);
    root.add(rim);
  }
  // Gate veil
  const curtain = curtainMaterial(starAmt(c));
  const cur = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 64), curtain);
  cur.renderOrder = 3;
  root.add(cur);
  // Rune stones: slowly orbiting on the outside, also appearing only after the keystone is in place
  const runes = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const rg = new THREE.Group();
    rg.position.set(Math.cos(a) * r * 1.22, Math.sin(a) * r * 1.22, 0);
    rg.rotation.z = a;
    rg.add(stoneMesh(new THREE.OctahedronGeometry(r * 0.07, 0), STONE));
    const l = new THREE.Mesh(new THREE.BoxGeometry(r * 0.02, r * 0.06, r * 0.01), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? GOLD : CORE).multiplyScalar(1.8), toneMapped: false }));
    l.position.z = r * 0.06;
    rg.add(l);
    runes.add(rg);
  }
  runes.visible = false;
  root.add(runes);
  // The seals in the gate: the sealed moves, one seal each, floating in the sea of stars (visible only after the gate opens)
  const seals = m.sealed.slice(0, 3).map((_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: runeCircleTex(3 + i), color: new THREE.Color(GOLD).multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.position.set((i - (Math.min(3, m.sealed.length) - 1) / 2) * r * 0.5, r * 0.15, r * 0.05);
    s.scale.setScalar(r * 0.36);
    s.renderOrder = 4;
    root.add(s);
    return s;
  });

  let open = 0;
  let glow = 0;
  let t = 0;
  const gate: Gate = {
    root,
    pos: pos.clone(),
    r,
    stones,
    curtain,
    seals,
    set(o, g) {
      open = o;
      glow = g;
    },
    kill: () => layer.kill(),
  };
  const layer = sc.vfx.layer(root, (dt) => {
    t += dt;
    curtain.uniforms.uT.value = t;
    curtain.uniforms.uOpen.value = open;
    curtain.uniforms.uGlow.value = glow;
    const lit = Math.min(1, Math.max(0, (stones[8].k - 0.9) * 10));
    for (const rim of rims) {
      const rm = rim.material as THREE.MeshBasicMaterial;
      rm.opacity = lit;
      rm.color.set(GOLD).multiplyScalar(1.15 + glow * 0.6);
    }
    runes.visible = lit > 0;
    runes.rotation.z -= dt * 0.35;
    gemGlow.material.opacity = 0.6 + glow * 0.5 + Math.sin(t * 6) * 0.1;
    for (const s of stones) {
      const k = ease.outCubic(Math.min(1, s.k));
      s.m.position.lerpVectors(s.from, s.to, k);
      const w = (1 - k) * 2.5;
      s.m.rotation.set(s.spin.x * w, s.spin.y * w, s.spin.z * w);
    }
  });
  registerInkRoot(root);
  return gate;
}

/** Gate veil opening and closing */
function openGate(c: UltCtx, to: number, dur: number, e = ease.outCubic): Promise<void> {
  const g = mem(c).gate;
  if (!g) return Promise.resolve();
  const from = g.curtain.uniforms.uOpen.value as number;
  const glow = g.curtain.uniforms.uGlow.value as number;
  return c.sc.tw.to(dur, (k) => g.set(from + (to - from) * k, glow * (1 - k)), e, 'fx');
}

/** Gate veil flares (impact, burst) */
function gateGlow(c: UltCtx, peak: number, dur: number): void {
  const g = mem(c).gate;
  if (!g) return;
  void c.sc.tw.to(dur, (k) => g.set(g.curtain.uniforms.uOpen.value as number, peak * (1 - k)), ease.outQuad, 'fx');
}

// ───────────────────────── Starlight ─────────────────────────

/** Starlight pouring: the river of stars pouring from the gate toward the opponent (amount follows the starlight %); the head of the river reaches the opponent in head seconds */
function cascade(c: UltCtx, from: THREE.Vector3, to: THREE.Vector3, rise: number, amt: number, dur: number, head = 0.3): void {
  const { sc } = c;
  const m = mem(c);
  // The river of stars flows along an arc over the sky: top of the gate → apex → above the opponent's head
  const apex = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, rise, 0));
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const at = (k: number, out: THREE.Vector3) => {
    const u = 1 - k;
    return out.copy(from).multiplyScalar(u * u).addScaledVector(apex, 2 * u * k).addScaledVector(to, k * k);
  };
  const rate = 30 + amt * 120;
  let acc = 0;
  let t = 0;
  const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
    t += dt;
    if (t > dur) {
      layer.kill();
      return;
    }
    const env = Math.max(0, 1 - Math.pow(t / dur, 3));
    acc += dt * rate * env;
    const n = Math.floor(acc);
    if (!n) return;
    acc -= n;
    // For the first head seconds the head of the river flows from the gate to the opponent, after which the whole river is flowing
    const hk = Math.min(1, t / head);
    for (let i = 0; i < n; i++) {
      const k = hk < 1 ? hk * (0.85 + Math.random() * 0.15) : Math.random();
      at(k, p);
      at(Math.min(1, k + 0.03), tan).sub(p).normalize();
      sc.vfx.emit({ pos: p, count: 1, color: [0xffa020, 0xffc040, 0xffd860, 0xff8c10], speed: [4, 8], dir: tan, spread: 0.3, life: [0.35, 0.7], size: [0.1, 0.26], sizeEnd: 0.03, radius: 0.25 + amt * 0.4, drag: 0.6, gravity: -2, intensity: 1.4, atlas: 1 });
    }
  });
  m.layers.push(layer);
}

/** The river itself: a glowing channel along the arc (gold stripes scrolling with the flow, bright in the center, fading at both ends); the head of the river reaches the opponent in head seconds */
function river(c: UltCtx, from: THREE.Vector3, apex: THREE.Vector3, to: THREE.Vector3, radius: number, dur: number, head = 0.3): void {
  const { sc } = c;
  const curve = new THREE.QuadraticBezierCurve3(from, apex, to);
  const mk = (r: number, col: number, hi: number, inten: number, gain: number) => new THREE.Mesh(new THREE.TubeGeometry(curve, 56, r, 12, false), new THREE.ShaderMaterial({
    // At impact the screen is pressed under a very deep indigo tint (multiplied by 0.24): additive gold has to be multiplied by its reciprocal to return to saturated gold, otherwise only mustard is left
    uniforms: { uCol: { value: new THREE.Color(col).multiplyScalar(inten) }, uHi: { value: new THREE.Color(hi).multiplyScalar(inten * 1.15) }, uT: { value: 0 }, uA: { value: 1 }, uHead: { value: 0 }, uGain: { value: gain } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uHi; uniform float uT; uniform float uA; uniform float uHead; uniform float uGain;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float x = vUv.x;
        if (x > uHead) discard;
        float f = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(f, 2.5);
        float ang = vUv.y * 6.2831853;
        // Golden streaks scrolling along the river channel, brightest at the head
        float flow = 0.65 + 0.35 * sin(ang * 3.0 + x * 40.0 - uT * 30.0) + 0.2 * sin(ang * 7.0 - x * 90.0 - uT * 44.0);
        float front = smoothstep(uHead, uHead - 0.1, x);
        float headGlow = exp(-abs(uHead - x) * 12.0) * step(uHead, 0.999) * 0.8;
        float ends = smoothstep(0.0, 0.06, x) * smoothstep(1.0, 0.92, x);
        float a = min(1.2, pow(f, 1.2) * flow * 0.7 + core * 0.8 + headGlow) * uGain * uA * front * ends;
        gl_FragColor = vec4(mix(uCol, uHi, core) * a, min(1.0, a));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  // The blue of the tint is 2.6 times red and green: any source with a bit of blue gets amplified into pinkish white, so even the highlights use a yellow without blue
  const core = mk(radius, 0xffb020, 0xffd040, 3.2, 1);
  const halo = mk(radius * 1.9, 0xff9020, 0xffb030, 2.0, 0.3);
  const g = new THREE.Group();
  g.add(halo, core);
  let t = 0;
  void sc.vfx.spawn(g, dur, (k, dt) => {
    t += dt;
    for (const m of [core, halo]) {
      const u = (m.material as THREE.ShaderMaterial).uniforms;
      u.uT.value = t;
      u.uHead.value = Math.min(1, (k * dur) / head);
      const hold = Math.min(0.8, head / dur + 0.3);
      u.uA.value = k < hold ? 1 : Math.pow(1 - (k - hold) / (1 - hold), 2);
    }
    const w = 1 + Math.sin(t * 30) * 0.05;
    g.scale.set(w, w, w);
  });
}

/** Constellation: at the moment of impact, a star chart connected from star points floats up on the opponent, then scatters */
function constellation(c: UltCtx, center: THREE.Vector3, radius: number, n: number, dur: number): void {
  const { sc } = c;
  const cam = sc.stage.camera;
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i * 1.7) * 1.2;
    const rr = radius * (0.35 + hash(i * 2.9) * 0.75);
    pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr * 1.15, 0));
  }
  // The lines are drawn as thin quads facing the camera (the whole set always faces the camera, so laying them out in the XY plane is enough): one layer for the bright core, one for the soft glow
  // Each line carries its own "stroke order" aK: as uK sweeps through, the line is drawn from one star to the next, as if someone were connecting the stars in the sky stroke by stroke
  const segs: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i < n; i++) {
    segs.push([pts[i], pts[(i + 1) % n]]);
    if (i % 3 === 0) segs.push([pts[i], pts[(i + 2) % n]]);
  }
  const ribbon = (w: number, col: THREE.ColorRepresentation, inten: number, gain: number) => {
    const v: number[] = [];
    const ks: number[] = [];
    const idx: number[] = [];
    segs.forEach(([a, b], i) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      const px = (-dy / l) * w;
      const py = (dx / l) * w;
      v.push(a.x - px, a.y - py, 0, a.x + px, a.y + py, 0, b.x - px, b.y - py, 0, b.x + px, b.y + py, 0);
      const k0 = i / segs.length;
      const k1 = (i + 0.95) / segs.length;
      ks.push(k0, k0, k1, k1);
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('aK', new THREE.Float32BufferAttribute(ks, 1));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(col).multiplyScalar(inten) }, uK: { value: 0 }, uA: { value: gain } },
      vertexShader: /* glsl */ `attribute float aK; uniform float uK; varying float vA;
        void main(){ vA = smoothstep(aK, aK + 0.05, uK); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uA; varying float vA;
        void main(){ float a = vA * uA; gl_FragColor = vec4(uCol * a, a); }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 20;
    g.add(m);
    return mat.uniforms;
  };
  const lm = ribbon(radius * 0.03, 0xffc030, 4.0, 1);
  const halo = ribbon(radius * 0.12, 0xff9020, 2.2, 0.7);
  const stars: THREE.Sprite[] = pts.map((p, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(), color: new THREE.Color(i % 3 ? 0xffc040 : 0xffd860).multiplyScalar(4.0), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.position.copy(p);
    s.renderOrder = 21;
    g.add(s);
    return s;
  });
  g.position.copy(center);
  void sc.vfx.spawn(g, dur, (k) => {
    g.quaternion.copy(cam.quaternion);
    // The first 45% draws the lines, the middle holds, the last 35% scatters
    const draw = Math.min(1, k / 0.45);
    const a = k < 0.65 ? 1 : Math.pow(1 - (k - 0.65) / 0.35, 1.5);
    lm.uK.value = draw;
    lm.uA.value = a;
    halo.uK.value = draw;
    halo.uA.value = a * 0.7;
    const grow = 1 + Math.max(0, k - 0.65) * 0.8;
    g.scale.setScalar(grow);
    stars.forEach((s, i) => {
      // The star points light up a step ahead of the lines: the i-th one pops out 0.08 before the stroke order reaches it
      const pop = Math.min(1, Math.max(0, (draw - i / n + 0.08) / 0.08));
      const tw = 0.75 + 0.25 * Math.sin(k * 40 + i * 2.1);
      s.scale.setScalar(radius * (i % 3 ? 0.3 : 0.44) * a * tw * (1 + (1 - pop) * 1.5));
      s.material.opacity = a * pop;
    });
  });
}

/** The locked seals shatter in front of the opponent */
function shatterSeals(c: UltCtx, names: string[]): void {
  const { sc, foe } = c;
  const cam = sc.stage.camera;
  const h = sc.slots[foe].creature?.worldHeight ?? 1.5;
  const center = sc.center(foe);
  const toCam = cam.position.clone().sub(center).normalize();
  names.forEach((_, i) => {
    const p = center.clone().addScaledVector(toCam, h * 0.5).add(new THREE.Vector3(0, h * (0.25 - i * 0.3), 0));
    const g = new THREE.Group();
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: runeCircleTex(3), color: new THREE.Color(GOLD).multiplyScalar(1.8), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    sp.renderOrder = 22;
    g.add(sp);
    g.position.copy(p);
    const size = h * 0.55;
    void sc.vfx.spawn(g, 0.5, (k) => {
      // First they swell and shake, then burst open after 0.3
      if (k < 0.3) {
        const s = size * (0.6 + k * 1.2) * (1 + Math.sin(k * 90) * 0.04);
        sp.scale.setScalar(s);
        sp.material.rotation += 0.02;
        sp.material.opacity = 1;
      } else sp.material.opacity = 0;
    });
    void c.wait(0.15 * (1 + i)).then(() => {
      void sc.vfx.glint(p, GOLD_HI, size * 0.9, 0.4, 3.5);
      void sc.vfx.debris(p, GOLD, 9, 5, 0.9, size * 0.12, size * 0.6);
      sc.vfx.emit({ pos: p, count: 40, color: [GOLD_HI, CORE_HI, 0xffffff], speed: [2, 6], life: [0.3, 0.6], size: [0.05, 0.14], radius: size * 0.4, drag: 2, atlas: 2, intensity: 0.9 });
      synth.noise({ type: 'highpass', f0: 3000, f1: 800, dur: 0.3, gain: 0.25 });
      synth.tone({ type: 'triangle', f0: 1800, f1: 400, dur: 0.3, gain: 0.08 });
      ultSfx.shing(0.75);
    });
  });
}

/** Seals flow downstream: the seals in the gate flow with the head of the river of stars to the front of the opponent (burst by shatterSeals on impact) */
function sealsRide(c: UltCtx, curve: THREE.Curve<THREE.Vector3>, head: number): void {
  const gate = mem(c).gate;
  if (!gate) return;
  gate.root.updateMatrixWorld(true);
  gate.seals.forEach((s, i) => {
    const start = s.getWorldPosition(new THREE.Vector3());
    const size = s.scale.x;
    s.visible = false;
    const mat = s.material.clone();
    mat.depthTest = false;
    const sp = new THREE.Sprite(mat);
    sp.renderOrder = 22;
    const g = new THREE.Group();
    g.add(sp);
    const lag = i * 0.07;
    const p0 = curve.getPoint(0);
    void c.sc.vfx.spawn(g, head, (k) => {
      const u = Math.min(1, Math.max(0, (k * head - lag) / (head - lag)));
      if (u < 0.15) sp.position.lerpVectors(start, p0, u / 0.15);
      else sp.position.copy(curve.getPoint(ease.inQuad((u - 0.15) / 0.85)));
      mat.rotation += 0.06;
      mat.opacity = u < 1 ? 0.95 : 0;
      sp.scale.setScalar(size * (1 + u * 0.4));
    });
  });
}

// ───────────────────────── Geometry and camera positions ─────────────────────────

/** The great star gate: directly behind the gatekeeper, its radius slightly taller than it; the gate center is about the height of its head, so seen from the opponent's side, the mane's small gate nests inside the great gate */
function gateSpec(c: UltCtx): { pos: THREE.Vector3; r: number; ground: THREE.Vector3; fwd: THREE.Vector3; h: number } {
  const { sc, side, cine } = c;
  const h = sc.slots[side].creature?.worldHeight ?? 1.5;
  const fwd = cine.forward(side);
  const r = h * 0.95;
  const ground = sc.slots[side].home.clone().addScaledVector(fwd, -h * 0.6).setY(0);
  return { pos: ground.clone().add(new THREE.Vector3(0, r * 0.88, 0)), r, ground, fwd, h };
}

/** Geometry of the river of stars: it surges from the upper half of the gate, passes over the gatekeeper's head, arcs over the sky and lands above the opponent's head; the star chart is drawn directly above the landing point */
function riverSpec(c: UltCtx): { from: THREE.Vector3; apex: THREE.Vector3; to: THREE.Vector3; chartC: THREE.Vector3; chartR: number; top: number } {
  const { sc, foe } = c;
  const g = gateSpec(c);
  const hf = sc.slots[foe].creature?.worldHeight ?? 1.5;
  const from = g.pos.clone().add(new THREE.Vector3(0, g.r * 0.5, 0)).addScaledVector(g.fwd, g.r * 0.15);
  const to = sc.center(foe).add(new THREE.Vector3(0, hf * 0.8, 0));
  const apex = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, hf * 1.2 + g.r * 0.3, 0));
  // The star chart is drawn directly above where the head of the river lands: when the follow camera stops, it is exactly at the top edge of the frame
  const chartR = hf * 0.6;
  const chartC = to.clone().add(new THREE.Vector3(0, chartR * 1.35, 0));
  return { from, apex, to, chartC, chartR, top: chartC.y + chartR * 1.2 };
}

/** How far away to frame a region of height hgt and width wid completely (by the current field-of-view multiplier and aspect ratio) */
function fitDist(c: UltCtx, hgt: number, wid: number, fovScale: number): number {
  const { sc } = c;
  const cam = sc.stage.camera;
  const halfTan = Math.tan(THREE.MathUtils.degToRad((cam.fov / sc.stage.fovScale) * fovScale * 0.5));
  return Math.max((hgt * 0.5) / halfTan, (wid * 0.5) / (halfTan * cam.aspect));
}

// ───────────────────────── Cinematic ─────────────────────────

/** Announcement → eyes open → build the gate → roar to open the gate */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side } = c;
  const m = mem(c);
  readState(c);
  const g = gateSpec(c);
  const h = g.h;
  const port = sc.portrait;
  const A = act(c);
  const head = sc.head(side);
  const center = sc.center(side);
  // Build the gate and compile the shaders first (the arch stones are all still underground), so there is no hitching midway through the cinematic
  const gate = makeGate(c, g.pos, g.r, g.fwd);
  m.gate = gate;
  sc.stage.prewarm();
  const keyPos = () => anchorPos(c, 'keystone', () => sc.head(side).add(new THREE.Vector3(0, h * 0.3, 0)));

  const tl = sc.gs.timeline('world');
  // ① Announcement: sky pressed to deep indigo; camera at a low angle right in front of the face
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    synth.dropMusic();
    synth.noise({ type: 'lowpass', f0: 260, f1: 90, dur: 1.4, gain: 0.35, attack: 0.5 });
    synth.tone({ type: 'sine', f0: 42, f1: 36, dur: 1.6, gain: 0.35, attack: 0.3 });
    cine.track(() => sc.head(side), ['vig', 'haze']);
    void cine.look({ letterbox: 1, vignette: 0.65, desat: 0.3, tint: 0x7c82c6, lift: 0x000000, bloom: 0.7, fov: port ? 1.3 : 1 }, 0.5, ease.outQuad);
    cine.cut(cine.orbitPos(side, head, 30, h * 0.95, -h * 0.16), head);
    void cine.shot(cine.orbitPos(side, head, 25, h * 0.82, -h * 0.13), head, 0.62, ease.outQuad);
  }, [], 0);
  // ② Eyes open: the half-lowered eyelids lift all at once
  tl.to(A, { wake: 1, duration: 0.22, ease: 'power3.out' }, 0.15);
  tl.call(() => {
    eyeGlint(c, CORE_HI, 1.1);
    bells(784, 0.03, 0.01, 0.9);
  }, [], 0.2);
  // ③ The starlight stones light up, the keystone on the forehead flashes
  tl.to(A, { glow: 0.7, duration: 0.6, ease: 'power1.inOut' }, 0.35);
  tl.call(() => void sc.vfx.glint(keyPos(), GOLD_HI, h * 0.2, 0.5, 2.5), [], 0.45);

  // ④ Pull back to the full body; the ground behind it cracks, and the arch stones rise from underground one by one (bottom to top)
  tl.call(() => {
    // Viewed from directly in front of the gatekeeper, 20° toward the audience side: the great gate is directly behind it, and the mane's small gate nests inside the great one
    const fov = port ? 1.3 : 1.25;
    const at = center.clone().lerp(g.pos, 0.55).setY(g.pos.y * 0.95);
    const dist = fitDist(c, g.r * 2.35, g.r * 2.5, fov);
    void cine.look({ fov }, 1.2);
    void cine.shot(cine.orbitPos(side, at, 20, dist, h * 0.1), at, 1.3, ease.inOutQuad);
    cine.track(() => g.pos, ['vig', 'haze']);
    void sc.vfx.decal(g.ground.clone().setY(0.04), crackTex(2), 0x3a3048, g.r * 2.6, 1.6, undefined, 0.7);
  }, [], 0.6);
  const order = [5, 6, 4, 7, 3, 0, 2, 1];
  order.forEach((i, j) => {
    const s = gate.stones[i];
    const t0 = 0.62 + j * 0.1;
    const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8;
    tl.call(() => {
      const base = gate.root.localToWorld(new THREE.Vector3(Math.cos(a0) * g.r, 0, 0)).setY(0.1);
      sc.vfx.smoke({ pos: base, count: 8, color: [0x8d846f, 0xb9b3a4], speed: [1, 3], dir: UP, spread: 0.5, life: [0.4, 0.9], size: [0.2, 0.45], sizeEnd: 0.8, radius: g.r * 0.2, drag: 1.5, gravity: -1.5 });
      void sc.vfx.debris(base, STONE_DK, 5, 3, 0.8, 0.08, 0.5);
    }, [], t0);
    tl.to(s, { k: 1, duration: 0.42, ease: 'none' }, t0);
    tl.call(() => {
      thud(0.2 + j * 0.015, 1 + (j % 3) * 0.1);
      sc.rig.addTrauma(0.1);
      const wp = gate.root.localToWorld(new THREE.Vector3(Math.cos(a0) * g.r, Math.sin(a0) * g.r, 0));
      sc.vfx.smoke({ pos: wp, count: 6, color: [0x9a917f, 0xd8d4c8], speed: [0.5, 1.5], life: [0.4, 0.8], size: [0.15, 0.35], sizeEnd: 0.5, radius: 0.2, drag: 2, gravity: 0.5 });
    }, [], t0 + 0.42);
  });

  // ⑤ The keystone falls from the sky: the gold rings light up; the keystone on its forehead answers at the same time
  const kT = 0.62 + order.length * 0.1 + 0.2;
  tl.call(() => synth.noise({ type: 'highpass', f0: 800, f1: 2500, dur: 0.22, gain: 0.12, attack: 0.18 }), [], kT - 0.2);
  tl.to(gate.stones[8], { k: 1, duration: 0.2, ease: 'power2.in' }, kT - 0.2);
  tl.call(() => {
    ultSfx.thump(0.7);
    thud(0.4, 0.8);
    sc.rig.addTrauma(0.4);
    cine.shock(g.pos.clone().add(new THREE.Vector3(0, g.r, 0)), 0.6, 0.45, 0.5);
    gateGlow(c, 1, 0.45);
    sc.vfx.emit({ pos: g.pos, count: 60, color: [GOLD_HI, GOLD], speed: [0.5, 2], life: [0.4, 0.8], size: [0.04, 0.1], radius: g.r * 0.92, drag: 2, intensity: 0.85, atlas: 1 });
    void sc.vfx.glint(keyPos(), GOLD_HI, h * 0.28, 0.5, 3);
    bells(392, 0.05, 0.02, 1.2);
  }, [], kT);

  // ⑥ Roar: mouth open, head thrown back, starlight showing in its mouth; the gate veil opens into a sea of stars, backlighting its outline
  const rT = kT + 0.33;
  tl.to(A, { roar: 1, duration: 0.2, ease: 'back.out(2)' }, rT);
  tl.to(A, { glow: 1, duration: 0.3 }, rT);
  tl.call(() => {
    playOr(roarUrl, () => {
      synth.tone({ type: 'sawtooth', f0: 110, f1: 70, dur: 1.1, gain: 0.16, attack: 0.08 });
      synth.noise({ type: 'bandpass', f0: 500, f1: 220, q: 1.2, dur: 1.1, gain: 0.3, attack: 0.08 });
    }, { gain: 0.9, peakIn: 0.3 });
    playOr(gateUrl, () => synth.noise({ type: 'highpass', f0: 600, f1: 5000, dur: 0.4, gain: 0.2, attack: 0.3 }), { gain: 0.6 });
    bells(523.25, 0.06, 0.05, 1.6);
    void openGate(c, 1, 0.45, ease.outCubic);
    void cine.look({ haze: 0.5, hazeRadius: 0.35, bloom: 0.85 }, 0.3);
    void cine.pulse({ radial: 0.5 }, { radial: 0 }, 0.5);
    sc.rig.addTrauma(0.35);
    const mouth = anchorPos(c, 'mouth', () => sc.head(side));
    sc.vfx.emit({ pos: mouth, count: 36, color: [CORE_HI, GOLD_HI, 0xffffff], speed: [1.5, 4], dir: g.fwd, spread: 0.6, life: [0.3, 0.6], size: [0.04, 0.1], radius: h * 0.06, drag: 1.8, intensity: 0.8, atlas: 1 });
    // Push in to above the chest, the gate behind it
    const at = sc.head(side).lerp(g.pos, 0.35);
    void cine.shot(cine.orbitPos(side, at, 18, fitDist(c, g.r * 1.95, g.r * 2.05, port ? 1.3 : 1.25), -h * 0.02), at, 0.6, ease.outCubic);
  }, [], rT);
  tl.to(gate.seals.map((s) => s.material), { opacity: 0.9, duration: 0.3 }, rT + 0.2);
  tl.call(() => void cine.look({ haze: 0.15 }, 0.3), [], rT + 0.3);
  tl.set({}, {}, rT + 0.62);
  await playTimeline(tl);
}

/** Floodgate: the river of stars bursts from the top of the gate and over the gatekeeper's head; the camera cuts to the audience side and follows the head of the river all the way to above the opponent's head */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  if (!m.gate) return;
  const g = gateSpec(c);
  const rs = riverSpec(c);
  const amt = starAmt(c);
  const port = sc.portrait;
  const hf = sc.slots[foe].creature?.worldHeight ?? 1.5;
  const foeC = sc.center(foe);
  // The time for the head of the river to reach the opponent = the length of this segment: as soon as deliver ends, the director plays the impact
  const HEAD = 1.0;
  const CUT = 0.34;
  const curve = new THREE.QuadraticBezierCurve3(rs.from, rs.apex, rs.to);

  const tl = sc.gs.timeline('world');
  // ① Floodgate: continuing the front-facing composition of the roar, the river of stars bursts from the top of the gate and arcs up over the gatekeeper's head; the camera tilts up with it
  tl.call(() => {
    cine.track(() => rs.from, ['radial', 'vig']);
    gateGlow(c, 0.9, 0.45);
    sc.stage.screenFlash(GOLD_HI, 0.12, 8);
    cine.shock(g.pos, 1.0, 0.5, 0.9);
    void sc.vfx.ring(g.pos, GOLD, g.r * 0.3, g.r * 1.35, 0.35, g.fwd);
    river(c, rs.from, rs.apex, rs.to, 0.4 + amt * 0.35, HEAD + 1.0 + amt * 0.4, HEAD);
    cascade(c, rs.from, rs.to, rs.apex.y - (rs.from.y + rs.to.y) / 2, amt, HEAD + 0.5 + amt * 0.4, HEAD);
    sealsRide(c, curve, HEAD);
    sc.rig.addTrauma(0.35);
    ultSfx.thump(0.6);
    playOr(punchUrl, () => sfx.whooshBig(), { gain: 0.7 });
    warp(HEAD);
    void cine.pulse({ radial: 0.6, lines: 0.25, linesColor: GOLD_HI }, { radial: 0, lines: 0 }, 0.4);
    // The camera does not move, it only tilts up: the gatekeeper's face stays at the bottom of the frame, with the river of stars surging from the top of the gate above
    const up = sc.head(side).lerp(curve.getPointAt(0.22), 0.65);
    void cine.shot(sc.rig.pos.clone(), up, CUT, ease.outQuad);
  }, [], 0);
  // ② Following the head of the river: audience side, viewed 70° from in front of the gatekeeper, the camera in sync with the head of the river, chasing it from the arch all the way to above the opponent's head
  tl.call(() => {
    const fov = port ? 1.3 : 1.15;
    void cine.look({ fov, radial: 0.25 }, 0.2);
    cine.track(() => sc.center(foe), ['radial', 'vig']);
    const r = sc.rig;
    const tok = r.claim();
    const dist = fitDist(c, hf * 2.8, hf * 3.4, fov);
    const p = new THREE.Vector3();
    const look = new THREE.Vector3();
    void sc.tw.to(HEAD - CUT, (k) => {
      if (!r.owns(tok)) return;
      const u = Math.min(1, (CUT + k * (HEAD - CUT)) / HEAD);
      curve.getPointAt(u, p);
      look.copy(p).lerp(foeC, 0.3 + 0.3 * u);
      r.pos.copy(cine.orbitPos(side, look, 70, dist, hf * 0.12));
      r.look.copy(look);
    }, ease.linear, 'world');
  }, [], CUT);
  tl.set({}, {}, HEAD);
  await playTimeline(tl);
}

/** Impact: the river of stars hits the opponent, gold flash, the star chart connects under the arch, the locked seals shatter, the ground cracks; the camera pulls back to a side wide shot */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe } = c;
  const m = mem(c);
  const amt = starAmt(c);
  const pos = sc.center(foe);
  const home = sc.slots[foe].home.clone();
  const h = sc.slots[foe].creature?.worldHeight ?? 1.5;
  const port = sc.portrait;
  gateGlow(c, 0.7, 0.5);
  // The director's white impact flash mixed over deep indigo turns into one frame of dead grey: replace it with its own gold flash (this hook runs after the director, so it can cover it)
  sc.stage.screenFlash(0xffe6a8, 0.9, 7);
  void sc.vfx.decal(home.clone().setY(0.05), crackTex(5), GOLD, h * 1.1 + 3, 2, undefined, 1.0);
  void sc.vfx.debris(home, STONE, 12, 7, 1.4, 0.22, 1.2);
  void sc.vfx.ring(home.clone().setY(0.1), GOLD, 0.6, 8, 0.7);
  sc.vfx.smoke({ pos: home.clone().setY(0.2), count: 14, color: [0x6f6656, 0x9a917f], speed: [2, 5], dir: UP, spread: 0.9, life: [0.6, 1.1], size: [0.2, 0.4], sizeEnd: 0.7, radius: h * 0.4, drag: 1.5, gravity: -1 });
  if (ev.hitIndex < ev.hits) return;
  sfx.impactBig();
  const rs = riverSpec(c);
  // The last surge of starlight crashes down and splashes into a sheet
  sc.vfx.emit({ pos: rs.to, count: 50 + Math.round(amt * 80), color: [0xffa020, 0xffc040, 0xffd860], speed: [3, 8], spread: 1.4, life: [0.3, 0.7], size: [0.08, 0.22], sizeEnd: 0.03, radius: h * 0.3, drag: 1.2, gravity: -3, intensity: 1.3, atlas: 1 });
  cascadeSfx(6 + Math.round(amt * 10));
  void c.wait(0.2).then(() => constellation(c, rs.chartC, rs.chartR, 7 + Math.round(amt * 5), 1.2));
  for (let i = 0; i < 2 + Math.round(amt * 3); i++) {
    const off = new THREE.Vector3((hash(i * 3.3) - 0.5) * h * 0.9, (hash(i * 5.1) - 0.3) * h * 0.8, (hash(i * 7.7) - 0.5) * h * 0.5);
    void c.wait(i * 0.05).then(() => sc.vfx.glint(pos.clone().add(off), i % 2 ? GOLD_HI : CORE_HI, h * 0.16, 0.4, 3));
  }
  if (m.sealed.length) shatterSeals(c, m.sealed);
  cine.track(() => sc.center(foe), ['radial', 'vig']);
  // During the white-flash frames the tint is pressed deeper and the glow made smaller so the flash does not smear into a haze; only afterwards are the gold light and the glow put back
  void cine.look({ bloom: 0.25, desat: 0.05, vignette: 0.92, tint: 0x3e3e8a }, 0);
  void c.wait(0.25).then(() => cine.look({ bloom: 0.3, tint: 0x7c82c6 }, 0.4, ease.outCubic));
  // The impact frames hold the follow-shot composition (the gate and gatekeeper on the left, the opponent on the right), then pull back and up a little so the star chart enters the top edge of the frame
  void c.wait(0.3).then(() => {
    const r = sc.rig;
    const look = r.look.clone().add(new THREE.Vector3(0, h * 0.45, 0));
    const pos = look.clone().add(r.pos.clone().sub(r.look).multiplyScalar(1.22)).add(new THREE.Vector3(0, h * 0.2, 0));
    void cine.look({ fov: port ? 1.3 : 1.18 }, 0.8);
    void cine.shot(pos, look, 0.8, ease.outCubic);
  });
  void c.wait(0.9).then(() => settleDark(c, 0.6));
  void cine.pulse({ radial: 0.9 }, { radial: 0 }, 0.45);
  cine.shock(pos, 1.3, 0.7, 1.2);
}

/**
 * Wrap up the cinematic's post-processing and ease the night back by half; after holding for hold seconds the camera pulls back to the wide shot, where the post-hit battle text is read.
 * The great gate stays behind the gatekeeper and sinks back underground only at after; the sky color is finally brought back by the safety net.
 */
function settleDark(c: UltCtx, hold: number): void {
  const { sc, cine } = c;
  void cine.look({ lines: 0, radial: 0, haze: 0, isolate: 0, bloom: sc.stage.bloomBase * 0.85, tint: 0xa6a8d8, desat: 0.12, vignette: 0.55 }, 0.6);
  void c.wait(hold).then(() => {
    cine.track(null);
    void sc.rig.reset(0.8);
    void cine.look({ fov: 1, roll: 0 }, 0.8);
  });
}

/** Blocked: the river of stars hits the barrier and the gate veil slams shut; the gatekeeper closes its mouth, still glaring at the opponent */
async function guarded(c: UltCtx): Promise<void> {
  const { sc } = c;
  const g = gateSpec(c);
  void ultGuarded(c);
  await c.wait(0.25);
  const tl = sc.gs.timeline('world');
  tl.to(act(c), { roar: 0, duration: 0.12, ease: 'power2.in' }, 0);
  tl.call(() => {
    void openGate(c, 0, 0.12, ease.inQuad);
    thud(0.5, 0.7);
    sc.rig.addTrauma(0.3);
    sc.vfx.smoke({ pos: g.ground, count: 20, color: [0x8d846f, 0xb9b3a4], speed: [1, 3], dir: UP, spread: 0.8, life: [0.5, 1], size: [0.2, 0.5], sizeEnd: 0.8, radius: g.r * 0.8, drag: 1.5, gravity: -1 });
  }, [], 0.08);
  tl.set({}, {}, 0.55);
  await playTimeline(tl);
}

/** Close the gate: the mouth closes, eyelids drop back to half-open; the gate veil draws in and the arch stones sink back underground one by one (keystone first) */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  for (const l of m.layers) l.kill();
  m.layers = [];
  const A = act(c);
  const tl = sc.gs.timeline('world');
  // In the wide shot: the gatekeeper closes its mouth and its eyelids drop back to half-open, the great gate behind it sinks underground, and the sky color brightens back bit by bit
  tl.call(() => void c.cine.look({ tint: 0xc4c6e6, desat: 0.06 }, 0.8), [], 0);
  tl.to(A, { roar: 0, duration: 0.25, ease: 'power2.inOut' }, 0);
  tl.to(A, { wake: 0, glow: 0, duration: 0.6, ease: 'power1.inOut' }, 0.35);
  const gate = m.gate;
  if (gate) {
    const spec = gateSpec(c);
    tl.call(() => void openGate(c, 0, 0.3, ease.inQuad), [], 0);
    for (const s of gate.seals) tl.to(s.material, { opacity: 0, duration: 0.2 }, 0);
    // The keystone also sinks down; it does not fly back to the sky
    gate.stones[8].from.set(0, -gate.pos.y - gate.r * 1.4, 0);
    tl.call(() => playOr(crumbleUrl, () => synth.noise({ type: 'lowpass', f0: 400, f1: 80, dur: 0.7, gain: 0.3 }), { gain: 0.5, rate: 0.85 }), [], 0.25);
    [8, 1, 2, 0, 3, 7, 4, 6, 5].forEach((i, j) => tl.to(gate.stones[i], { k: 0, duration: 0.5, ease: 'power2.in' }, 0.3 + j * 0.05));
    for (let i = 0; i < 3; i++) {
      tl.call(() => {
        thud(0.16, 0.85 + i * 0.1);
        sc.vfx.smoke({ pos: spec.ground.clone().add(new THREE.Vector3((hash(i * 9) - 0.5) * spec.r * 1.5, 0.1, 0)), count: 10, color: [0x8d846f, 0xd8d4c8], speed: [0.5, 2], dir: UP, spread: 0.8, life: [0.5, 1], size: [0.2, 0.5], sizeEnd: 0.9, radius: 0.3, drag: 1.5, gravity: -1 });
      }, [], 0.5 + i * 0.14);
    }
    tl.call(() => {
      gate.kill();
      m.gate = undefined;
    }, [], 1.1);
  }
  await playTimeline(tl);
}

export default defineSsr({
  windup,
  deliver,
  impact,
  guarded,
  settle: (c) => settleDark(c, 0.5),
  after,
});
