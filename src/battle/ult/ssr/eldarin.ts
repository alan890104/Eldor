// Eldarin, Dragon of the First Pact: "True Name: Eldarin"
//
// What this cinematic is about: the old dragon speaks its true name. The pact sigil on its forehead (the prototype of the Grand Pact) grows into a giant golden seal behind it, and along the top edge of the seal the four characters of its name, "Eldarin", are burned in;
// the clauses of the Grand Pact turn into gold stakes, gold rings and chains that pin the opponent in place, and finally the giant seal flips face down and lands on top of the cage, stamping the pact onto the opponent (ignores guard: no one escapes a pact).
// Model: the pact sigil on the forehead is two ring grooves, eight radial notches and a diamond gem at the center; the giant seal behind it is the same pattern scaled up, solid gold with an outline.
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed)
//   windup
//     0.00  Announcement: letterbox, the sky turns to dusk indigo and gold (its own sky dome), the arena is pressed dark; the camera at a low angle in front of the face (audience side 30°) pushes toward the forehead, the old dragon closes its eyes (focus, shut); a low drone and a low bell
//     0.30  The pact sigil on the forehead burns bright (sigil), at 0.50 the forehead flashes; the ignition bell tone (eldarin-ignite)
//     0.56  Eyes open: the eye glints of the golden pupils and a "ching"
//     0.66  Head raised, wings spread (raise, spread, rear 0.3): the wings beat once (eldarin-wings), and over 0.55 s the camera pulls back to a nearly frontal (12°) low-angle full-body shot;
//           a light disk rises from the forehead and flies behind it
//     0.84  The giant seal assembles behind it: the eight segments of the outer ring slam in from the outside, the outer ring closes at 1.18 (the first eldarin-lock hit); the eight notches stab in from the front and the inner ring springs open
//     1.43  The diamond gem at the center flies into the seal's heart from the camera's side and sets at 1.66 (the second eldarin-lock hit, low bell): the whole seal lights up and the magic circle in the seal's heart starts to turn
//     1.70  Roar (roar, eldarin-roar): along the top edge of the seal "Eldarin" is burned in character by character (a quill-stroke sound for each character); the signature shot pushes in to the head and the upper half of the seal, the head framed inside the inner ring
//     2.26  The giant seal gives the order: eight beams of golden light shoot from the eight notches toward the opponent
//     2.34  Cut to the opponent: from audience side 115° slowly orbiting to 82°, the golden light flying in from behind the camera; four gold stakes are driven from the sky into the ground one by one (all on the half circle opposite the audience, so they do not block the camera),
//           at 2.54 the upper and lower gold rings clamp shut (eldarin-bind), at 2.80 four gold chains are drawn link by link from the tops of the stakes to the upper ring (eldarin-chain),
//           the five clauses (Grand Pact) are written stroke by stroke inside the cage, with the number of times the pact was broken stamped as a vermilion seal on the last clause; at 3.10 the whole cage flares and the opponent flashes gold
//     3.22  End
//   deliver
//     0.00  The old dragon roars again to give the order; the giant seal leaves its back, rising and flipping face down as it goes, flying along an arc to above the opponent's head, trailing golden specks;
//           the camera cuts to a wide shot on the audience side at the midpoint between the two (100° turning to 78°), panning with the giant seal from behind the old dragon to above the opponent's head
//     0.50  Cut to the target's view: a low angle behind the opponent at audience side 40°, the old dragon with spread wings in the distance; the look-at point sits between the giant seal and the opponent and follows the seal down,
//           the seal pressing down from the top of the frame with acceleration (the whoosh of eldarin-descend lined up with the landing point)
//     1.00  The seal lands on the upper ring (handed to the director to play the impact)
//   impact: hit-stop, a vermilion flash, the opponent flashes vermilion (eldarin-stamp); the seal squashes flat then springs back, a vermilion beam strikes from the seal face to the ground, leaving a vermilion seal, golden seal patterns and cracks on the ground;
//           at 0.30 the camera retreats back and up from the target's view; at 0.45 the cage and giant seal break into golden specks that stream all the way back to the old dragon's forehead (eldarin-dissolve);
//           at 1.00 the forehead flashes, holds 0.55 s, then pulls back to the wide shot (the battle text is read in the wide shot)
//   guarded: (the ultimate ignores guard, so in theory this does not happen) the giant seal hits the barrier, bounces up and scatters, and the cage falls apart
//   after: wings fold, mouth closes, head lowers, and the pact sigil returns to its normal brightness (all action weights go back to zero); the sky dome fades out and all VFX objects are removed

import * as THREE from 'three';
import { playOr, preloadSamples } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import bindUrl from '../../../audio/sfx/eldarin-bind.mp3';
import chainUrl from '../../../audio/sfx/eldarin-chain.mp3';
import descendUrl from '../../../audio/sfx/eldarin-descend.mp3';
import dissolveUrl from '../../../audio/sfx/eldarin-dissolve.mp3';
import igniteUrl from '../../../audio/sfx/eldarin-ignite.mp3';
import lockUrl from '../../../audio/sfx/eldarin-lock.mp3';
import quillUrl from '../../../audio/sfx/eldarin-quill.mp3';
import roarUrl from '../../../audio/sfx/eldarin-roar.mp3';
import stampUrl from '../../../audio/sfx/eldarin-stamp.mp3';
import wingsUrl from '../../../audio/sfx/eldarin-wings.mp3';
import { crackTex } from '../../../render/fxtex.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { sceneMaterial, type SpiritMaterial } from '../../../render/spiritToon.ts';
import { glowTex, ringTex, runeCircleTex } from '../../../render/textures.ts';
import { ease } from '../../../render/tween.ts';
import { additive, type FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, eyeGlint } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [igniteUrl, wingsUrl, lockUrl, roarUrl, quillUrl, bindUrl, chainUrl, stampUrl, descendUrl, dissolveUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const GOLD = 0xffd24a;
const GOLD_HI = 0xfff2c0;
/** Solid gold (the same color as the gold inlay on the model's forehead) */
const GOLD_S = 0xf0c254;
const INK = 0xffe08a;
const VERMILION = 0xff4a2a;
const UP = new THREE.Vector3(0, 1, 0);
const PI = Math.PI;
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};

/** The true name: carved along the top edge of the giant seal, left to right */
const NAME = ['艾', '爾', '達', '林'];
/** The clauses of the Grand Pact: vertical writing */
const CLAUSES = ['一、不得格擋', '二、不得替換', '三、不得秘術', '四、不得伏技', '違者、違約'];
const FONT = '"Noto Serif TC", "Songti TC", "PingFang TC", "Hiragino Mincho ProN", "Microsoft JhengHei", serif';

interface Mem {
  breaches: number;
  spec?: Spec;
  sigil?: Sigil;
  cage?: Cage;
  sky?: Sky;
  brow?: FxLayer;
}
const mem = (c: UltCtx): Mem => (c.mem.eld ??= { breaches: 0 }) as Mem;
const low = (c: UltCtx): boolean => c.sc.stage.quality === 'low';

/** The old dragon's action weights (only effective on the experimental model) */
const act = (c: UltCtx): Record<string, number> => c.sc.slots[c.side].creature?.act ?? {};
const ACTS = ['focus', 'sigil', 'raise', 'roar', 'speak', 'spread', 'rear', 'shut', 'turn'];

/** World position of an anchor; use fallback when the legacy model has no such anchor */
function anchorPos(c: UltCtx, name: string, fallback: () => THREE.Vector3): THREE.Vector3 {
  const cr = c.sc.slots[c.side].creature;
  const a = cr?.anchor(name);
  if (!cr || !a) return fallback();
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}
const browPos = (c: UltCtx): THREE.Vector3 => anchorPos(c, 'sigil', () => c.sc.head(c.side));

// ───────────────────────── Textures: gold-ink characters ─────────────────────────

const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Vermilion seal: characters in a square frame, with edges deliberately uneven, like pressed-on seal paste */
function chop(g: CanvasRenderingContext2D, x: number, y: number, s: number, text: string, col: string): void {
  g.save();
  g.translate(x, y);
  g.rotate(-0.12);
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = s * 0.07;
  g.lineJoin = 'round';
  g.strokeRect(-s / 2, -s / 2, s, s);
  g.font = `bold ${Math.floor(s * 0.62)}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, s * 0.04);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * PI * 2 + 0.3;
    const r = s * (0.5 + (i % 3) * 0.02);
    g.beginPath();
    g.arc(Math.cos(a) * r, Math.sin(a) * r, s * (0.02 + (i % 4) * 0.012), 0, PI * 2);
    g.fill();
  }
  g.restore();
}

/** One vertically written clause (gold ink, with a ring of ink halo around the characters); the number of breaches is stamped as a vermilion seal on the last clause */
function columnTex(text: string, breaches: number): THREE.Texture {
  return canvasTex(`eld:col:${text}:${breaches}`, 256, 1280, (g) => {
    g.font = `128px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffb63a';
    g.shadowColor = 'rgba(255,190,70,0.9)';
    g.shadowBlur = 14;
    const chars = [...text];
    const step = 150;
    const y0 = 110;
    chars.forEach((ch, i) => g.fillText(ch, 128, y0 + i * step));
    g.shadowBlur = 6;
    g.fillStyle = 'rgba(255,220,140,0.55)';
    g.fillRect(232, 50, 4, Math.min(1230, y0 + chars.length * step - 40));
    if (breaches > 0) {
      g.shadowBlur = 4;
      g.shadowColor = 'rgba(255,60,30,0.6)';
      for (let i = 0; i < Math.min(breaches, 3); i++) chop(g, 80 + (i % 2) * 90, y0 + chars.length * step + 30 + i * 110, 104, '違約', 'rgba(255,74,42,0.95)');
    }
  });
}

/** One character on the giant seal (gold ink, with a ring of glow around it) */
function charTex(ch: string): THREE.Texture {
  return canvasTex(`eld:ch:${ch}`, 256, 256, (g) => {
    g.font = `bold 200px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,200,90,0.95)';
    g.shadowBlur = 18;
    g.fillStyle = '#ffc24e';
    g.fillText(ch, 128, 136);
    g.shadowBlur = 0;
    g.fillStyle = '#fff0c4';
    g.fillText(ch, 128, 136);
  });
}

/** The vermilion seal on the ground: a square seal reading "Eldarin" */
function sealTex(): THREE.Texture {
  return canvasTex('eld:seal', 512, 512, (g) => {
    g.shadowColor = 'rgba(255,90,50,0.7)';
    g.shadowBlur = 10;
    chop(g, 256, 256, 300, '', '#ff5a36');
    g.shadowBlur = 8;
    g.fillStyle = '#ff5a36';
    g.font = `bold 118px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.translate(256, 256);
    g.rotate(-0.12);
    for (const [ch, x, y] of [['艾', -70, -66], ['爾', 70, -66], ['達', -70, 70], ['林', 70, 70]] as [string, number, number][]) g.fillText(ch, x, y);
    g.restore();
  });
}

/** Gold-ink characters revealed stroke by stroke: they appear along the uv direction, with the pen tip (the edge being written) especially bright; depth-tested, so parts hidden by the body do not show through */
function inkMaterial(map: THREE.Texture, intensity: number, axis: 'y' | 'x'): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uReveal: { value: 0 }, uA: { value: 1 }, uI: { value: intensity } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uReveal; uniform float uA; uniform float uI; varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        float p = ${axis === 'y' ? '1.0 - vUv.y' : 'vUv.x'};
        float edge = uReveal - p;
        float vis = smoothstep(-0.015, 0.015, edge);
        float tip = exp(-max(edge, 0.0) * 14.0) * 1.4 * step(uReveal, 0.999);
        float a = t.a * vis * uA;
        gl_FragColor = vec4(t.rgb * uI * (1.0 + tip) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

// ───────────────────────── Solid gold ─────────────────────────

/** Solid parts: the scene's cartoon material, going through the post-processing outline for scene objects */
function solid(geo: THREE.BufferGeometry, mat: SpiritMaterial): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.layers.enable(INK_LAYER);
  m.userData.inkScene = true;
  return m;
}
const goldMat = (): SpiritMaterial => sceneMaterial(GOLD_S, { surface: 'metal', emissive: 0xffa820, emissiveAmt: 0.22, rim: 0.5 });
const gemMat = (): SpiritMaterial => sceneMaterial(0xfff2c2, { surface: 'gem', emissive: 0xffc23a, emissiveAmt: 0.7, rim: 0.4 });

/** Parts for tweening: k 0 is at the start (not yet appeared), 1 is in place */
interface Piece {
  o: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  spin: THREE.Vector3;
  k: number;
  /** The direction they drift outward in when scattering */
  drift: THREE.Vector3;
}
function piece(o: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, spin: THREE.Vector3): Piece {
  o.position.copy(from);
  o.visible = false;
  const drift = to.clone().setZ(0);
  if (drift.lengthSq() < 1e-6) drift.set(0, 1, 0);
  return { o, from, to, spin, k: 0, drift: drift.normalize() };
}

// ───────────────────────── Sky ─────────────────────────

interface Sky {
  fade: { k: number };
  kill(): void;
}

/** Dusk sky dome: deep indigo overhead, a ring of gold at the horizon, faint star points; it follows the camera and fades in and out */
function skyDome(c: UltCtx): Sky {
  const { sc } = c;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: 0 },
      uT: { value: 0 },
      uTop: { value: new THREE.Color(0x141a44) },
      uMid: { value: new THREE.Color(0x40306a) },
      uHor: { value: new THREE.Color(0xd9985a) },
      uFog: { value: new THREE.Color() },
    },
    vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uA; uniform float uT; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uFog; varying vec3 vD;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vD);
        float h = d.y;
        vec3 c = mix(uFog, uHor, smoothstep(-0.06, 0.02, h));
        c = mix(c, uMid, smoothstep(0.03, 0.32, h));
        c = mix(c, uTop, smoothstep(0.32, 0.95, h));
        vec3 q = floor(d * 110.0);
        float s = step(0.9965, hash(q)) * smoothstep(0.18, 0.5, h);
        s *= 0.6 + 0.4 * sin(uT * (1.5 + hash(q + 3.1) * 3.0) + hash(q) * 40.0);
        c += vec3(1.0, 0.94, 0.8) * max(s, 0.0) * 0.9;
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
  const layer = sc.vfx.layer(m, (dt) => {
    m.position.copy(cam.position);
    (mat.uniforms.uFog.value as THREE.Color).copy(sc.arena.fog.color);
    mat.uniforms.uT.value += dt;
    mat.uniforms.uA.value = fade.k;
    m.visible = fade.k > 0.002;
  });
  return { fade, kill: () => layer.kill() };
}

// ───────────────────────── Giant seal ─────────────────────────

interface SigilState {
  /** The light of the whole seal (the gem, the self-illumination of the gold inlay, and the backlight) */
  heat: number;
  /** The magic circle in the seal's heart */
  runes: number;
  /** Flight: 0 is behind the dragon, 1 is above the opponent's head */
  u: number;
  /** Pressing down: 0 is above the head, 1 is landed on the upper ring */
  drop: number;
  /** Squashed on landing */
  squash: number;
  /** Scattering */
  dissolve: number;
}

/**
 * The giant seal behind the old dragon: eight outer ring segments, eight gold studs at the outer ring's seams, eight radial notches, the inner ring, and the central diamond gem (the same pattern as the sigil on the forehead),
 * the four characters of "Eldarin" on the top edge, the magic circle in the seal's heart and the backlight. Each part's k is tweened by the timeline; flight and pressing down are set by st.
 */
class Sigil {
  root = new THREE.Group();
  face = new THREE.Group();
  arcs: Piece[] = [];
  ticks: Piece[] = [];
  inner: Piece;
  gem: Piece;
  chars: THREE.ShaderMaterial[] = [];
  st: SigilState = { heat: 0, runes: 0, u: 0, drop: 0, squash: 0, dissolve: 0 };
  R: number;
  home: THREE.Vector3;
  private q0 = new THREE.Quaternion();
  private q1 = new THREE.Quaternion();
  private curve?: THREE.QuadraticBezierCurve3;
  private top = new THREE.Vector3();
  private stopY = 0;
  private sEnd = 1;
  private layer: FxLayer;
  private gold = goldMat();
  private gemM = gemMat();

  constructor(c: UltCtx, pos: THREE.Vector3, R: number, fwd: THREE.Vector3) {
    const { sc } = c;
    this.R = R;
    this.home = pos.clone();
    this.root.position.copy(pos);
    this.root.lookAt(pos.clone().add(fwd));
    this.q0.copy(this.root.quaternion);
    // Seal face down: +z points to the ground, with the top of the characters toward the opponent
    const d = new THREE.Object3D();
    d.up.copy(fwd);
    d.lookAt(0, -1, 0);
    this.q1.copy(d.quaternion);
    this.root.add(this.face);
    const lo = low(c);
    // Outer ring: eight arcs, slamming in obliquely from the outside; a diamond gold stud at the start of each segment covers the seam
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      const g = new THREE.Group();
      g.rotation.z = a;
      g.add(solid(new THREE.TorusGeometry(R, R * 0.05, 8, lo ? 8 : 14, PI / 4), this.gold));
      const stud = solid(new THREE.OctahedronGeometry(R * 0.075, 0), this.gold);
      stud.position.set(R, 0, 0);
      stud.scale.set(1, 1, 0.7);
      g.add(stud);
      const m = a + PI / 8;
      this.face.add(g);
      const p = piece(g, new THREE.Vector3(Math.cos(m) * R * 0.55, Math.sin(m) * R * 0.55, R * 0.7), new THREE.Vector3(), new THREE.Vector3(0, 0, i % 2 ? 0.7 : -0.7));
      p.drift.set(Math.cos(m), Math.sin(m), 0);
      this.arcs.push(p);
    }
    // Eight radial notches: slender diamonds, stabbing in from the front
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      const t = solid(new THREE.OctahedronGeometry(1, 0), this.gold);
      t.scale.set(R * 0.055, R * 0.17, R * 0.05);
      t.rotation.z = a - PI / 2;
      const to = new THREE.Vector3(Math.cos(a) * R * 0.81, Math.sin(a) * R * 0.81, 0);
      this.face.add(t);
      this.ticks.push(piece(t, to.clone().add(new THREE.Vector3(0, 0, R * 1.1)), to, new THREE.Vector3()));
    }
    // Inner ring
    const inner = new THREE.Group();
    inner.add(solid(new THREE.TorusGeometry(R * 0.62, R * 0.034, 8, lo ? 40 : 72), this.gold));
    this.face.add(inner);
    this.inner = piece(inner, new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(0, 0, 2.4));
    // The central diamond gem: flies in from the camera's side (the front of the seal)
    const gem = new THREE.Group();
    const gm = solid(new THREE.OctahedronGeometry(R * 0.2, 0), this.gemM);
    gm.scale.set(0.72, 1.12, 0.45);
    gem.add(gm);
    this.face.add(gem);
    this.gem = piece(gem, new THREE.Vector3(0, 0, R * 2.2), new THREE.Vector3(0, 0, R * 0.02), new THREE.Vector3(0, 3, 0));
    // The true name: four characters on the top edge, set between the notches
    NAME.forEach((ch, i) => {
      const a = PI - (PI / 8) * (1 + 2 * i);
      const mat = inkMaterial(charTex(ch), 1.5, 'y');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.28, R * 0.28), mat);
      m.position.set(Math.cos(a) * R * 0.81, Math.sin(a) * R * 0.81, R * 0.02);
      m.rotation.z = a - PI / 2;
      m.renderOrder = 7;
      this.face.add(m);
      this.chars.push(mat);
    });
    // The magic circle in the seal's heart (additive) and the backlight of the whole seal
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.2, R * 1.2), additive(GOLD, runeCircleTex(4), 1.0));
    rune.position.z = -R * 0.01;
    rune.renderOrder = 5;
    const runeMat = rune.material as THREE.MeshBasicMaterial;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.3, R * 2.3), additive(GOLD, runeCircleTex(2), 0.8));
    halo.position.z = -R * 0.04;
    halo.renderOrder = 4;
    const haloMat = halo.material as THREE.MeshBasicMaterial;
    const back = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(GOLD).multiplyScalar(1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    back.position.z = -R * 0.2;
    back.scale.setScalar(R * 3.4);
    back.renderOrder = 3;
    this.face.add(rune, halo, back);

    const all = [...this.arcs, ...this.ticks, this.inner, this.gem];
    let t = 0;
    const tmp = new THREE.Vector3();
    this.layer = sc.vfx.layer(this.root, (dt) => {
      t += dt;
      const s = this.st;
      // Parts: tween into place (the outer ring and notches are slammed in: the closer they get the faster they go), shrinking and drifting outward when scattering
      for (const p of all) {
        const k = Math.min(1, p.k);
        p.o.visible = k > 0.001 && s.dissolve < 0.999;
        tmp.lerpVectors(p.from, p.to, k);
        const w = 1 - k;
        if (s.dissolve > 0) tmp.addScaledVector(p.drift, s.dissolve * R * 0.35);
        p.o.position.copy(tmp);
        p.o.rotation.x = p.spin.x * w;
        p.o.rotation.y = p.spin.y * w;
        if (p === this.inner) {
          p.o.rotation.z = p.spin.z * w + t * 0.4;
          p.o.scale.setScalar(Math.max(0.001, (0.25 + 0.75 * k) * (1 - s.dissolve)));
        } else if (this.ticks.includes(p)) {
          p.o.scale.set(R * 0.055, R * 0.17 * (0.3 + 0.7 * k), R * 0.05).multiplyScalar(Math.max(0.001, 1 - s.dissolve));
        } else {
          if (p !== this.gem) p.o.rotation.z = (p.o.userData.a0 ??= p.o.rotation.z) + p.spin.z * w;
          p.o.scale.setScalar(Math.max(0.001, 1 - s.dissolve));
        }
      }
      const heat = s.heat * (1 - s.dissolve);
      this.gold.uniforms.uEmissiveAmt.value = 0.22 + heat * 0.35;
      this.gemM.uniforms.uEmissiveAmt.value = 0.7 + heat * 0.45 + Math.sin(t * 7) * 0.06 * heat;
      runeMat.opacity = s.runes * (1 - s.dissolve) * (0.65 + Math.sin(t * 5) * 0.08);
      rune.rotation.z = -t * 0.5;
      haloMat.opacity = s.runes * (1 - s.dissolve) * 0.3;
      halo.rotation.z = t * 0.2;
      back.material.opacity = Math.min(1, heat) * 0.32;
      for (const m of this.chars) m.uniforms.uA.value = 1 - s.dissolve;
      // Flight, pressing down and squashing
      if (this.curve && s.u > 0) {
        if (s.drop > 0) this.root.position.set(this.top.x, this.top.y + (this.stopY - this.top.y) * s.drop, this.top.z);
        else this.curve.getPoint(s.u, this.root.position);
        this.root.quaternion.slerpQuaternions(this.q0, this.q1, THREE.MathUtils.smoothstep(s.u, 0.05, 0.75));
        const sc0 = 1 + (this.sEnd - 1) * THREE.MathUtils.smoothstep(s.u, 0, 0.8);
        this.root.scale.setScalar(sc0);
      }
      const q = s.squash;
      this.face.scale.set(1 + q * 0.07, 1 + q * 0.07, Math.max(0.2, 1 - q * 0.55));
    });
    registerInkRoot(this.root);
  }

  /** Flight path: arcing over the sky from behind the dragon to above the opponent's head, finally landing at stopY; sEnd is the scale-up factor on landing */
  plan(top: THREE.Vector3, apexRise: number, stopY: number, sEnd: number): void {
    const apex = this.home.clone().lerp(top, 0.5).add(new THREE.Vector3(0, apexRise, 0));
    this.curve = new THREE.QuadraticBezierCurve3(this.home.clone(), apex, top.clone());
    this.top.copy(top);
    this.stopY = stopY;
    this.sEnd = sEnd;
  }

  /** Position of a part in the world (used as the start of the golden light) */
  world(o: THREE.Object3D): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return o.getWorldPosition(new THREE.Vector3());
  }

  kill(): void {
    this.layer.kill();
  }
}

// ───────────────────────── Pact cage ─────────────────────────

interface CageState {
  heat: number;
  dissolve: number;
  /** Fade-out of the clauses as a whole */
  cols: number;
}

/**
 * Placement of the gold stakes (see Cage's dirOf): all four are on the half circle opposite the audience, like stage scenery, with the camera's side left open.
 * The camera orbits between audience side 25° and 140°, so the stakes never stand between the camera and the opponent.
 */
const STAKE_A = [-10, 190, 235, 305].map((d) => THREE.MathUtils.degToRad(d));

/**
 * The cage surrounding the opponent: four gold stakes falling from the sky, upper and lower gold rings (outer ring, thin inner ring, twelve engraved marks, four gems),
 * four gold chains drawn from the stake tops to the upper ring (connected link by link), and five vertically written clauses. The solid parts all have outlines.
 */
class Cage {
  root = new THREE.Group();
  stakes: { g: THREE.Group; k: number; top: THREE.Vector3 }[] = [];
  hoops: { g: THREE.Group; k: number; spin: number; y: number }[] = [];
  chains: { links: THREE.Mesh[]; k: number }[] = [];
  cols: { m: THREE.Mesh; mat: THREE.ShaderMaterial; a: number }[] = [];
  st: CageState = { heat: 0, dissolve: 0, cols: 1 };
  private layer: FxLayer;
  private gold = goldMat();
  private gemM = gemMat();

  constructor(c: UltCtx, home: THREE.Vector3, fwd: THREE.Vector3, vs: THREE.Vector3, Rc: number, Rs: number, hoopY: [number, number], hf: number, breaches: number) {
    const { sc } = c;
    const lo = low(c);
    this.root.position.copy(home);
    // Bearing: a = 0 faces behind the opponent (the direction the caster looks), positive values turn toward the audience side (vs); root itself does not rotate, which makes it easy to compute the clauses facing the camera
    const dirOf = (a: number) => fwd.clone().multiplyScalar(Math.cos(a)).addScaledVector(vs, Math.sin(a));
    // Gold stakes: tip pointing down into the ground, a diamond gem and a ring of small gold rings at the stake top; tilted slightly outward
    const L = hf * 1.25 + 0.6;
    const TILT = 0.12;
    for (let i = 0; i < 4; i++) {
      const a = STAKE_A[i];
      const d = dirOf(a);
      const g = new THREE.Group();
      g.position.copy(d).multiplyScalar(Rs);
      g.rotation.y = Math.atan2(d.x, d.z);
      const inner = new THREE.Group();
      inner.rotation.x = TILT;
      g.add(inner);
      const tip = solid(new THREE.ConeGeometry(0.1, 0.5, 4), this.gold);
      tip.rotation.x = PI;
      tip.position.y = -0.1;
      const shaft = solid(new THREE.CylinderGeometry(0.075, 0.1, L, 4), this.gold);
      shaft.position.y = 0.15 + L / 2;
      const collar = solid(new THREE.TorusGeometry(0.15, 0.035, 6, 16), this.gold);
      collar.rotation.x = PI / 2;
      collar.position.y = 0.15 + L;
      const cap = solid(new THREE.OctahedronGeometry(0.19, 0), this.gemM);
      cap.scale.set(0.75, 1.3, 0.75);
      cap.position.y = 0.15 + L + 0.24;
      inner.add(tip, shaft, collar, cap);
      g.visible = false;
      this.root.add(g);
      this.stakes.push({ g, k: 0, top: new THREE.Vector3(0, 0.15 + L, 0) });
    }
    // Upper and lower gold rings
    hoopY.forEach((y, j) => {
      const R = Rc * (j ? 1.08 : 1);
      const g = new THREE.Group();
      g.position.y = y;
      const ring = solid(new THREE.TorusGeometry(R, R * 0.045, 8, lo ? 48 : 80), this.gold);
      ring.rotation.x = PI / 2;
      const ring2 = solid(new THREE.TorusGeometry(R * 0.9, R * 0.018, 6, lo ? 40 : 72), this.gold);
      ring2.rotation.x = PI / 2;
      g.add(ring, ring2);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        const t = solid(new THREE.BoxGeometry(R * 0.035, R * 0.07, i % 3 ? R * 0.1 : R * 0.18), this.gold);
        t.position.set(Math.cos(a) * R * 0.95, 0, Math.sin(a) * R * 0.95);
        t.rotation.y = -a;
        g.add(t);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + PI / 4;
        const gm = solid(new THREE.OctahedronGeometry(R * 0.06, 0), this.gemM);
        gm.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
        gm.scale.set(1, 1.6, 1);
        g.add(gm);
      }
      g.visible = false;
      this.root.add(g);
      this.hoops.push({ g, k: 0, spin: j ? -0.35 : 0.5, y });
    });
    // Gold chains: from stake top to upper ring at the same bearing, link by link
    const linkGeo = new THREE.TorusGeometry(0.075, 0.022, 4, lo ? 6 : 8);
    for (let i = 0; i < 4; i++) {
      const s = this.stakes[i];
      const d = dirOf(STAKE_A[i]);
      const ty = s.top.y - 0.05;
      const from = d.clone().multiplyScalar(Rs + Math.sin(TILT) * ty).setY(Math.cos(TILT) * ty);
      const to = d.clone().multiplyScalar(Rc).setY(hoopY[0]);
      const dir = to.clone().sub(from);
      const len = dir.length();
      dir.normalize();
      const n = Math.max(4, Math.floor(len / 0.12));
      const links: THREE.Mesh[] = [];
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      const twist = new THREE.Quaternion().setFromAxisAngle(dir, PI / 2);
      for (let k = 0; k < n; k++) {
        const m = solid(linkGeo, this.gold);
        m.position.copy(from).addScaledVector(dir, ((k + 0.5) / n) * len);
        m.quaternion.copy(q);
        if (k % 2) m.quaternion.premultiply(twist);
        m.visible = false;
        this.root.add(m);
        links.push(m);
      }
      this.chains.push({ links, k: 0 });
    }
    // Clauses: five vertical lines inside the cage, slowly turning around, always facing the camera; the ones on the far side fade
    const colH = Math.max(0.8, hoopY[0] - hoopY[1] - 0.2);
    CLAUSES.forEach((text, i) => {
      const mat = inkMaterial(columnTex(text, i === CLAUSES.length - 1 ? breaches : 0), 1.35, 'y');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(colH * 0.2, colH), mat);
      m.renderOrder = 8;
      m.position.y = (hoopY[0] + hoopY[1]) / 2;
      this.root.add(m);
      this.cols.push({ m, mat, a: (i / CLAUSES.length) * PI * 2 });
    });

    let turn = 0;
    let t = 0;
    const cam = sc.stage.camera;
    const wp = new THREE.Vector3();
    this.layer = sc.vfx.layer(this.root, (dt) => {
      t += dt;
      turn += dt * 0.35;
      const s = this.st;
      const dz = Math.max(0.001, 1 - s.dissolve);
      for (const st of this.stakes) {
        st.g.visible = st.k > 0.001 && s.dissolve < 0.999;
        // Falls straight down from the sky, fastest in the last stretch
        st.g.position.y = (1 - st.k) * 9;
        st.g.scale.setScalar(dz);
      }
      for (const h of this.hoops) {
        h.g.visible = h.k > 0.001 && s.dissolve < 0.999;
        h.g.scale.setScalar(Math.max(0.001, (1 + (1 - h.k) * 1.6) * dz));
        h.g.rotation.y += h.spin * dt * (0.3 + (1 - h.k) * 4);
      }
      for (const ch of this.chains) {
        const n = Math.floor(ch.k * ch.links.length + 1e-4);
        ch.links.forEach((l, i) => {
          l.visible = i < n && s.dissolve < 0.999;
          l.scale.setScalar(dz);
        });
      }
      const r = Rc * 0.82;
      for (const col of this.cols) {
        const a = col.a + turn;
        col.m.position.x = Math.cos(a) * r;
        col.m.position.z = Math.sin(a) * r;
        col.m.getWorldPosition(wp);
        // Faces the camera around the y axis only (vertically written clauses always stand upright)
        col.m.rotation.y = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z);
        const near = THREE.MathUtils.clamp((wp.distanceTo(cam.position) - (cam.position.distanceTo(this.root.position) - r)) / (2 * r), 0, 1);
        col.mat.uniforms.uA.value = s.cols * (1 - near * 0.7);
      }
      this.gold.uniforms.uEmissiveAmt.value = 0.22 + s.heat * 0.5;
      this.gemM.uniforms.uEmissiveAmt.value = 0.7 + s.heat * 0.9 + Math.sin(t * 8) * 0.06;
    });
    registerInkRoot(this.root);
  }

  /** World position of the stake foot (the ground) */
  stakeFoot(i: number): THREE.Vector3 {
    const s = this.stakes[i];
    this.root.updateMatrixWorld(true);
    return this.root.localToWorld(new THREE.Vector3(s.g.position.x, 0.05, s.g.position.z));
  }

  kill(): void {
    this.layer.kill();
  }
}

// ───────────────────────── Sound ─────────────────────────
// The ignition, wing beat, latch, dragon roar, quill, gold chain, seal landing, fall and shatter are audio files generated by ElevenLabs (synthesized versions are used until they finish loading); the bell and low drone are always synthesized

const snd = {
  /** The pact bell: a low bell with overtones */
  bell(f = 392, gain = 0.2, delay = 0) {
    synth.tone({ type: 'sine', f0: f, dur: 1.6, gain, delay });
    synth.tone({ type: 'sine', f0: f * 2.76, dur: 0.9, gain: gain * 0.3, delay });
    synth.tone({ type: 'triangle', f0: f * 1.5, dur: 0.5, gain: gain * 0.15, delay });
  },
  /** The low drone of the pact: layered sawtooth waves like a chorus */
  drone(dur = 3) {
    for (const [f, d] of [[55, 0], [82.5, 6], [110, -5]] as const) synth.tone({ type: 'sawtooth', f0: f, dur, gain: 0.035, attack: 0.5, detune: d });
    synth.tone({ type: 'sine', f0: 110, dur, gain: 0.06, attack: 0.6 });
  },
  quill(delay = 0) {
    playOr(quillUrl, () => {
      for (let i = 0; i < 3; i++) synth.noise({ type: 'bandpass', f0: 3600 + i * 400, f1: 2400, q: 4, dur: 0.06 + (i % 2) * 0.03, gain: 0.12, delay: delay + i * 0.055 });
    }, { gain: 1.3, delay, rate: 0.92 + Math.random() * 0.16 });
  },
  /** A small metallic click (a part set in place) */
  clink(pitch = 1, gain = 0.06) {
    synth.tone({ type: 'triangle', f0: 1900 * pitch, f1: 1200 * pitch, dur: 0.12, gain });
    synth.noise({ type: 'highpass', f0: 5000, dur: 0.04, gain: gain * 1.6 });
  },
  /** A gold stake hitting the ground */
  stake(gain = 0.5) {
    playOr(stampUrl, () => synth.noise({ type: 'lowpass', f0: 1800, f1: 120, dur: 0.2, gain: 0.4 }), { gain: gain * 0.7, rate: 1.35 });
    synth.tone({ type: 'sine', f0: 90, f1: 40, dur: 0.3, gain: gain * 0.6 });
  },
  stamp() {
    ultSfx.thump(0.8);
    playOr(stampUrl, () => {
      synth.noise({ type: 'lowpass', f0: 2800, f1: 120, dur: 0.24, gain: 0.55 });
      synth.noise({ type: 'bandpass', f0: 900, q: 0.7, dur: 0.05, gain: 0.45 });
    }, { gain: 0.95 });
    synth.tone({ type: 'sine', f0: 62, f1: 30, dur: 0.8, gain: 0.45 });
    synth.tone({ type: 'sine', f0: 523, dur: 1.4, gain: 0.07, delay: 0.05 });
  },
};

// ───────────────────────── Geometry and camera positions ─────────────────────────

interface Spec {
  h: number;
  hf: number;
  fwd: THREE.Vector3;
  home: THREE.Vector3;
  foeHome: THREE.Vector3;
  /** Radius and position of the giant seal (directly behind the dragon, the seal's heart at about the height of its head) */
  R: number;
  sigC: THREE.Vector3;
  /** The cage: gold ring radius, gold stake radius, upper and lower ring heights */
  Rc: number;
  Rs: number;
  hoopY: [number, number];
  /** The height at which the giant seal lands on the upper ring, the position above the head before pressing down, and the scale-up factor on landing */
  stopY: number;
  top: THREE.Vector3;
  sEnd: number;
}

/** The opponent's actual size: height and the farthest horizontal distance from the center (for a long, horizontal body like the whale or the tortoise, the cage has to enclose the body length) */
function foeSize(c: UltCtx): { hf: number; half: number } {
  const cr = c.sc.slots[c.foe].creature;
  const home = c.sc.slots[c.foe].home;
  if (!cr) return { hf: 1.5, half: 0.8 };
  cr.root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(cr.root);
  if (b.isEmpty()) return { hf: cr.worldHeight, half: cr.worldHeight * 0.45 };
  const half = Math.max(Math.abs(b.min.x - home.x), Math.abs(b.max.x - home.x), Math.abs(b.min.z - home.z), Math.abs(b.max.z - home.z));
  return { hf: Math.max(cr.worldHeight, b.max.y - home.y), half };
}

/** The geometry of this cinematic (computed once at the opening: the opponent's size changes with its idle animation during the cinematic) */
function spec(c: UltCtx): Spec {
  const m = mem(c);
  if (m.spec) return m.spec;
  const { sc, side, cine } = c;
  const h = sc.slots[side].creature?.worldHeight ?? 1.5;
  const { hf, half } = foeSize(c);
  const fwd = cine.forward(side);
  const home = sc.slots[side].home.clone();
  const foeHome = sc.slots[c.foe].home.clone();
  const R = h * 0.78;
  const sigC = home.clone().addScaledVector(fwd, -h * 0.55).setY(h * 1.0);
  const Rc = Math.max(hf * 0.45 + 0.45, half + 0.35);
  const hoopY: [number, number] = [hf + 0.2, Math.min(hf * 0.14 + 0.06, 0.4)];
  // The giant seal covers the upper ring: scaled up to be a size larger than the upper ring; the gold stakes are outside the giant seal
  const sEnd = Math.max(1, (Rc * 1.15) / R);
  const Rs = Math.max(R * sEnd * 1.15, Rc * 1.4);
  const stopY = hoopY[0] + R * sEnd * 0.08;
  const top = foeHome.clone().setY(stopY + R * sEnd * 0.9 + 0.9);
  m.spec = { h, hf, fwd, home, foeHome, R, sigC, Rc, Rs, hoopY, stopY, top, sEnd };
  return m.spec;
}

/** How far away to frame a region of height hgt and width wid completely (by the current field-of-view multiplier and aspect ratio) */
function fitDist(c: UltCtx, hgt: number, wid: number, fovScale: number): number {
  const { sc } = c;
  const cam = sc.stage.camera;
  const halfTan = Math.tan(THREE.MathUtils.degToRad((cam.fov / sc.stage.fovScale) * fovScale * 0.5));
  return Math.max((hgt * 0.5) / halfTan, (wid * 0.5) / (halfTan * cam.aspect));
}

/** Glow of the pact sigil on the forehead: follows the anchor and is nudged toward the camera (otherwise the forehead cuts half of it off), with brightness following act.sigil */
function browGlow(c: UltCtx, h: number): FxLayer {
  const { sc } = c;
  const A = act(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(GOLD).multiplyScalar(1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sp.renderOrder = 10;
  const cam = sc.stage.camera;
  let t = 0;
  return sc.vfx.layer(sp, (dt) => {
    t += dt;
    const p = browPos(c);
    sp.position.copy(p).addScaledVector(cam.position.clone().sub(p).normalize(), h * 0.1);
    const k = A.sigil ?? 0;
    sp.material.opacity = k * (0.75 + Math.sin(t * 9) * 0.08);
    sp.scale.setScalar(h * (0.16 + 0.1 * k));
    sp.visible = k > 0.01;
  });
}

// ───────────────────────── Cinematic ─────────────────────────

/** Announcement → light the pact sigil → eyes open → spread wings and build the seal → roar to burn in the true name → the giant seal gives the order, gold stakes, rings and chains lock the opponent */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const me = c.view.sides[side];
  m.breaches = me.team[me.active]?.marks.find((mk) => mk.id === 'kit:breach')?.n ?? 0;
  m.spec = undefined;
  const S = spec(c);
  const { h, hf, fwd, R } = S;
  const port = sc.portrait;
  const A = act(c);
  const lo = low(c);

  // Build all the solid parts first (all still hidden), compile the shaders and upload the canvas textures, so there is no hitching midway through the cinematic
  const sig = new Sigil(c, S.sigC, R, fwd);
  m.sigil = sig;
  const vs = cine.orbitPos(side, S.foeHome, 90, 1, 0).sub(S.foeHome);
  const cage = new Cage(c, S.foeHome, fwd, vs, S.Rc, S.Rs, S.hoopY, hf, m.breaches);
  m.cage = cage;
  const sky = skyDome(c);
  m.sky = sky;
  m.brow = browGlow(c, h);
  sc.stage.prewarm();
  for (const t of [...NAME.map(charTex), sealTex(), ...CLAUSES.map((s, i) => columnTex(s, i === CLAUSES.length - 1 ? m.breaches : 0))]) sc.stage.renderer.initTexture(t);

  const face = () => sc.head(side);
  const tl = sc.gs.timeline('world');

  // ① Announcement: the sky turns to dusk, the camera at a low angle right in front of the face, the old dragon closes its eyes
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    synth.dropMusic();
    snd.bell(392, 0.2);
    snd.drone(3.2);
    cine.track(face, ['vig', 'haze']);
    void cine.look({ letterbox: 1, vignette: 0.7, desat: 0.2, tint: 0xa9a2c4, lift: 0x06030c, bloom: 0.55, grain: 0.06, fov: port ? 1.3 : 1 }, 0.5, ease.outQuad);
    const f = face();
    cine.cut(cine.orbitPos(side, f, 30, h * 0.9, -h * 0.14), f.clone().add(new THREE.Vector3(0, -h * 0.05, 0)));
    const b = browPos(c);
    void cine.shot(cine.orbitPos(side, b, 24, h * 0.66, -h * 0.1), b, 0.66, ease.inOutQuad);
    // Tiny golden ink specks float up from the ground: the ritual begins
    sc.vfx.emit({ pos: S.home.clone().lerp(S.foeHome, 0.5).setY(0.3), count: lo ? 30 : 70, color: [GOLD, INK], speed: [0.1, 0.4], dir: UP, spread: 0.3, life: [1.5, 2.6], size: [0.02, 0.05], radius: h * 2.2, gravity: 0.15, drag: 0.3, intensity: 0.9 });
  }, [], 0);
  tl.to(sky.fade, { k: 1, duration: 0.6, ease: 'power1.out' }, 0);
  tl.to(A, { focus: 1, duration: 0.2 }, 0);
  tl.to(A, { shut: 1, duration: 0.12, ease: 'power2.in' }, 0.02);

  // ② The pact sigil on the forehead burns bright
  tl.call(() => {
    playOr(igniteUrl, () => ultSfx.shing(0.6), { gain: 1.1, peakIn: 0.22 });
    cine.track(() => browPos(c), ['vig', 'haze']);
  }, [], 0.3);
  tl.to(A, { sigil: 1, duration: 0.35, ease: 'power2.in' }, 0.3);
  tl.call(() => {
    const b = browPos(c);
    void sc.vfx.glint(b.addScaledVector(sc.stage.camera.position.clone().sub(b).normalize(), h * 0.1), GOLD_HI, h * 0.12, 0.45, 2.5);
    sc.vfx.emit({ pos: browPos(c), count: 12, color: [GOLD, INK], speed: [0.2, 0.7], life: [0.5, 0.9], size: [0.03, 0.07], radius: h * 0.08, gravity: 0.6, drag: 1.5, intensity: 0.8 });
  }, [], 0.5);

  // ③ Eyes open
  tl.to(A, { shut: 0, duration: 0.08, ease: 'power3.out' }, 0.56);
  tl.call(() => eyeGlint(c, GOLD_HI, 1), [], 0.58);

  // ④ Head raised, wings spread: the camera pulls back all at once to a low-angle full-body shot, and a light disk flies from the forehead to behind it
  const T4 = 0.66;
  tl.to(A, { raise: 1, spread: 1, duration: 0.45, ease: 'power3.out' }, T4);
  tl.to(A, { rear: 0.3, duration: 0.5, ease: 'power2.out' }, T4);
  tl.call(() => {
    playOr(wingsUrl, () => sfx.whooshBig(), { gain: 0.9, peakIn: 0.14 });
    ultSfx.swell(0.3, 0.12);
    sc.rig.addTrauma(0.15);
    const fov = port ? 1.3 : 1.2;
    const at = S.home.clone().addScaledVector(fwd, -h * 0.25).setY(h * 0.95);
    const dist = fitDist(c, h * 2.2, R * 2.7, fov);
    // The camera is directly in front of the old dragon shooting back, with the opponent behind the camera; the head of a long opponent (the whale) would poke in from the right edge of the frame, so it is put back at ⑨
    cine.offstage(foe, true);
    void cine.look({ fov }, 0.5);
    void cine.shot(cine.orbitPos(side, at, 12, dist, -h * 0.5), at, 0.55, ease.outExpo);
    cine.track(() => S.sigC, ['vig', 'haze']);
    // Light disk: rises from the forehead and grows as it flies, scattering when it reaches the giant seal's position, while the outer ring slams in at the same time
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), additive(GOLD, runeCircleTex(4), 1.4));
    disc.renderOrder = 9;
    const from = browPos(c);
    void sc.vfx.spawn(disc, 0.34, (k) => {
      const e = ease.outCubic(k);
      disc.position.lerpVectors(from, S.sigC, e).add(new THREE.Vector3(0, Math.sin(k * PI) * h * 0.3, 0));
      disc.quaternion.copy(sig.root.quaternion);
      disc.rotateZ(k * 4);
      disc.scale.setScalar(h * 0.08 + R * 0.9 * e);
      (disc.material as THREE.MeshBasicMaterial).opacity = k < 0.8 ? 1 : (1 - k) / 0.2;
    });
  }, [], T4);

  // ⑤ The giant seal assembles: the eight outer ring segments slam in, the notches stab in, the inner ring springs open
  const T5 = 0.84;
  const order = [2, 6, 0, 4, 1, 5, 3, 7];
  order.forEach((i, j) => {
    tl.to(sig.arcs[i], { k: 1, duration: 0.16, ease: 'power3.in' }, T5 + j * 0.025);
    tl.call(() => snd.clink(0.9 + (j % 3) * 0.08, 0.05), [], T5 + j * 0.025 + 0.16);
  });
  const ringDone = T5 + 7 * 0.025 + 0.16;
  tl.call(() => {
    playOr(lockUrl, () => ultSfx.thump(0.4), { gain: 1.1, peakIn: 0 });
    sc.rig.addTrauma(0.25);
    cine.shock(S.sigC, 0.45, 0.4, 0.5);
    sc.vfx.emit({ pos: S.sigC, count: lo ? 30 : 60, color: [GOLD_HI, GOLD], speed: [0.5, 2], life: [0.3, 0.6], size: [0.04, 0.09], radius: R, drag: 2, intensity: 0.8, atlas: 1 });
  }, [], ringDone);
  tl.to(sig.st, { heat: 0.4, duration: 0.2 }, ringDone);
  sig.ticks.forEach((p, j) => {
    tl.to(p, { k: 1, duration: 0.12, ease: 'power2.in' }, ringDone + 0.02 + j * 0.02);
    if (j % 2) tl.call(() => snd.clink(1.25, 0.035), [], ringDone + 0.14 + j * 0.02);
  });
  tl.to(sig.inner, { k: 1, duration: 0.3, ease: 'back.out(2.2)' }, ringDone + 0.06);

  // ⑥ The central gem flies into the seal's heart: the second latch (in the same audio file as the first, 0.48 s apart)
  const T6 = ringDone + 0.48;
  tl.to(sig.gem, { k: 1, duration: 0.22, ease: 'power2.in' }, T6 - 0.22);
  tl.call(() => {
    ultSfx.thump(0.5);
    snd.bell(523, 0.1);
    sc.rig.addTrauma(0.3);
    cine.shock(S.sigC, 0.7, 0.45, 0.7);
    void sc.vfx.glint(S.sigC.clone().addScaledVector(fwd, R * 0.1), GOLD_HI, R * 0.4, 0.45, 3);
    void sc.vfx.ring(S.sigC, GOLD, R * 0.2, R * 1.6, 0.4, fwd);
  }, [], T6);
  tl.to(sig.st, { heat: 1, runes: 1, duration: 0.3, ease: 'power2.out' }, T6);

  // ⑦ Roar: the true name burned in character by character; the signature shot pushes in
  const T7 = T6 + 0.04;
  tl.to(A, { roar: 1, duration: 0.2, ease: 'back.out(2)' }, T7);
  tl.call(() => {
    playOr(roarUrl, () => {
      synth.tone({ type: 'sawtooth', f0: 110, f1: 70, dur: 1.1, gain: 0.16, attack: 0.08 });
      synth.noise({ type: 'bandpass', f0: 500, f1: 220, q: 1.2, dur: 1.1, gain: 0.3, attack: 0.08 });
    }, { gain: 0.75, peakIn: 0.2 });
    void cine.look({ haze: 0.45, hazeRadius: 0.35 }, 0.3);
    void cine.pulse({ radial: 0.55 }, { radial: 0 }, 0.55);
    sc.rig.addTrauma(0.4);
    const mouth = anchorPos(c, 'mouth', face);
    cine.shock(mouth, 0.9, 0.5, 0.8);
    sc.vfx.emit({ pos: mouth, count: lo ? 20 : 40, color: [GOLD_HI, GOLD, 0xffffff], speed: [1.5, 4], dir: fwd, spread: 0.6, life: [0.3, 0.6], size: [0.04, 0.1], radius: h * 0.05, drag: 1.8, intensity: 0.8, atlas: 1 });
    // Push in: the head and the upper half of the giant seal, the head framed inside the inner ring
    const fov = port ? 1.3 : 1.15;
    const at = face().lerp(S.sigC, 0.35).add(new THREE.Vector3(0, h * 0.08, 0));
    void cine.look({ fov }, 0.6);
    void cine.shot(cine.orbitPos(side, at, 10, fitDist(c, R * 1.75, R * 2.3, fov), -h * 0.32), at, 0.6, ease.outCubic);
  }, [], T7);
  NAME.forEach((_, i) => {
    const t0 = T7 + 0.04 + i * 0.1;
    tl.call(() => snd.quill(), [], t0);
    tl.to(sig.chars[i].uniforms.uReveal, { value: 1, duration: 0.14, ease: 'none' }, t0);
    tl.call(() => {
      const a = PI - (PI / 8) * (1 + 2 * i);
      const p = sig.root.localToWorld(new THREE.Vector3(Math.cos(a) * R * 0.81, Math.sin(a) * R * 0.81, R * 0.05));
      sc.vfx.emit({ pos: p, count: 8, color: [INK, GOLD_HI], speed: [0.2, 0.8], life: [0.3, 0.6], size: [0.03, 0.07], radius: R * 0.1, gravity: 1.2, intensity: 0.8 });
    }, [], t0 + 0.12);
  });

  // ⑧ The giant seal gives the order: eight beams of golden light shoot toward the opponent
  const T8 = T7 + 0.56;
  tl.to(A, { roar: 0.3, duration: 0.3, ease: 'power2.inOut' }, T8);
  tl.call(() => {
    ultSfx.swell(0.3, 0.2);
    sfx.whooshBig();
    sc.stage.screenFlash(GOLD_HI, 0.12, 8);
    const foeC = sc.center(foe);
    sig.ticks.forEach((p, i) => {
      const from = sig.world(p.o);
      const to = foeC.clone().add(new THREE.Vector3(Math.cos(i * 0.8) * S.Rc * 0.8, (hash(i) - 0.3) * hf * 0.6, Math.sin(i * 0.8) * S.Rc * 0.8));
      void sc.vfx.streak(from, to, i % 2 ? GOLD : GOLD_HI, 0.07, 2.2, 0.34 + (i % 3) * 0.03);
    });
  }, [], T8);

  // ⑨ Cut to the opponent: gold stakes, gold rings, gold chains, clauses
  const T9 = T8 + 0.08;
  tl.call(() => {
    const fov = port ? 1.3 : 1.1;
    cine.offstage(foe, false);
    void cine.look({ fov, haze: 0, radial: 0.2 }, 0.15);
    cine.track(() => sc.center(foe), ['vig', 'radial']);
    const topY = hf * 1.25 + 1.2;
    const look = () => S.foeHome.clone().setY(topY * 0.45);
    const d0 = fitDist(c, topY * 1.2, S.Rs * 2.5, fov);
    void cine.arc(side, S.foeHome, [115, 82], [d0 * 1.08, d0 * 0.98], [hf * 0.35 + 0.5, hf * 0.25 + 0.35], 0.96, ease.outQuad, look);
    void sc.vfx.decal(S.foeHome.clone().setY(0.05), runeCircleTex(2), GOLD, S.Rs * 2.4, 2.4, 0, 1.2);
  }, [], T9);
  const stakeOrder = [3, 0, 2, 1];
  stakeOrder.forEach((i, j) => {
    const t0 = T9 + 0.04 + j * 0.07;
    tl.to(cage.stakes[i], { k: 1, duration: 0.12, ease: 'power3.in' }, t0);
    tl.call(() => {
      snd.stake(0.45 + j * 0.05);
      sc.rig.addTrauma(0.14);
      const p = cage.stakeFoot(i);
      sc.vfx.smoke({ pos: p, count: lo ? 5 : 10, color: [0x8d846f, 0xb9a88a], speed: [1, 3], dir: UP, spread: 0.7, life: [0.35, 0.7], size: [0.15, 0.35], sizeEnd: 0.7, radius: 0.2, drag: 2, gravity: -1 });
      sc.vfx.emit({ pos: p, count: 10, color: [GOLD, GOLD_HI], speed: [1, 3], dir: UP, spread: 0.7, life: [0.25, 0.45], size: [0.04, 0.09], gravity: -4, drag: 2, intensity: 0.8 });
      void sc.vfx.decal(p.clone().setY(0.06), crackTex(j + 1), 0x3a3048, 1.4, 1.8, hash(j) * 6, 0.6);
    }, [], t0 + 0.12);
  });
  const TH = T9 + 0.2;
  tl.call(() => {
    playOr(bindUrl, () => synth.noise({ type: 'bandpass', f0: 2600, f1: 900, q: 3, dur: 0.3, gain: 0.2 }), { gain: 2.4, peakIn: 0.18 });
  }, [], TH);
  cage.hoops.forEach((hp, j) => {
    tl.to(hp, { k: 1, duration: 0.2, ease: 'back.out(1.6)' }, TH + j * 0.1);
    tl.call(() => {
      snd.clink(0.7 - j * 0.1, 0.08);
      sc.rig.addTrauma(0.12);
      void sc.vfx.ring(S.foeHome.clone().setY(hp.y), GOLD, S.Rc * 0.9, S.Rc * 1.5, 0.3);
    }, [], TH + j * 0.1 + 0.18);
  });
  const TC = TH + 0.26;
  tl.call(() => playOr(chainUrl, () => snd.clink(0.8, 0.1), { gain: 1.0 }), [], TC);
  cage.chains.forEach((ch, j) => tl.to(ch, { k: 1, duration: 0.16, ease: 'power1.in' }, TC + j * 0.03));
  cage.cols.forEach((col, i) => {
    tl.to(col.mat.uniforms.uReveal, { value: 1, duration: 0.14, ease: 'none' }, T9 + 0.2 + i * 0.07);
    if (i % 2 === 0) tl.call(() => snd.quill(), [], T9 + 0.2 + i * 0.07);
  });
  const TE = TC + 0.3;
  tl.call(() => {
    ultSfx.thump(0.4);
    snd.bell(659, 0.08);
    sc.rig.addTrauma(0.25);
    cine.shock(sc.center(foe), 0.5, 0.4, 0.5);
    sc.slots[foe].creature?.setFlash(GOLD, 0.35);
  }, [], TE);
  tl.to(cage.st, { heat: 1, duration: 0.1 }, TE);
  tl.to(cage.st, { heat: 0.4, duration: 0.3 }, TE + 0.1);
  tl.set({}, {}, TE + 0.12);
  await playTimeline(tl);
}

/** The giant seal flips over and flies to above the opponent's head, cuts to the target's view, presses down */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const sig = m.sigil;
  if (!sig) return;
  const S = spec(c);
  const { h, hf, R } = S;
  const port = sc.portrait;
  const FLY = 0.5;
  const DROP = 0.5;
  sig.plan(S.top, h * 0.9 + 1.4, S.stopY, S.sEnd);

  const tl = sc.gs.timeline('world');
  // ① Flight: a wide shot on the audience side (the midpoint between the two, 100° turning to 78°), the camera panning with the giant seal from behind the old dragon to above the opponent's head
  const A = act(c);
  tl.to(A, { roar: 0.85, duration: 0.12, ease: 'power2.out' }, 0);
  tl.to(A, { roar: 0.2, duration: 0.4, ease: 'power2.inOut' }, 0.2);
  tl.call(() => {
    sfx.whooshBig();
    ultSfx.swell(FLY, 0.16);
    const fov = port ? 1.3 : 1.15;
    void cine.look({ fov, radial: 0.25, lines: 0.2, linesColor: GOLD_HI }, 0.15);
    const r = sc.rig;
    const tok = r.claim();
    const mid = S.home.clone().lerp(S.foeHome, 0.5);
    const span = S.home.distanceTo(S.foeHome);
    const dist = fitDist(c, h * 2.4, span * 0.95, fov);
    const low0 = mid.clone().setY(h * 0.55);
    const p = new THREE.Vector3();
    cine.track(() => sig.root.position, ['radial', 'vig']);
    void sc.tw.to(FLY, (k) => {
      if (!r.owns(tok)) return;
      p.copy(sig.root.position).lerp(low0, 0.45);
      r.pos.copy(cine.orbitPos(side, mid, 100 - 22 * k, dist, h * 0.35));
      r.look.copy(p);
    }, ease.linear, 'world');
  }, [], 0);
  tl.to(sig.st, { u: 1, duration: FLY, ease: 'power2.inOut' }, 0);
  // Where the giant seal has flown it trails a string of golden specks (random points on the outer edge)
  {
    const lo = low(c);
    const trail = sc.vfx.layer(new THREE.Object3D(), () => {
      if (sig.st.dissolve > 0 || sig.st.drop >= 1) {
        trail.kill();
        return;
      }
      if (sig.st.u <= 0) return;
      const n = lo ? 2 : 5;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * PI * 2;
        const p = sig.root.localToWorld(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0));
        sc.vfx.emit({ pos: p, count: 1, color: [GOLD, GOLD_HI, INK], speed: [0.2, 0.8], life: [0.35, 0.7], size: [0.05, 0.12], sizeEnd: 0.02, radius: 0.05, drag: 1.5, gravity: 0.5, intensity: 0.9, atlas: 1 });
      }
    });
  }
  // ② Cut to the target's view: a low angle behind the opponent at audience side 38°, the old dragon with spread wings in the distance; the giant seal presses down with acceleration
  tl.call(() => {
    playOr(descendUrl, () => sfx.whooshBig(), { gain: 0.85, endIn: DROP });
    const fov = port ? 1.3 : 1.12;
    void cine.look({ fov, lines: 0.3, radial: 0.35 }, 0.2);
    cine.track(() => sc.center(foe), ['radial', 'vig']);
    // The look-at point is shifted a bit toward the old dragon: the opponent on one side of the frame, the distant old dragon on the other; the giant seal presses down from the top of the frame
    // The look-at point sits between the giant seal and the opponent and follows the seal down: the seal stays in the upper half of the frame and the opponent in the lower half
    const d0 = fitDist(c, S.stopY * 1.6 + 1.0, S.Rc * 2.8, fov);
    const toward = S.home.clone().sub(S.foeHome).multiplyScalar(0.12);
    const base = S.foeHome.clone().add(toward);
    const p0 = cine.orbitPos(side, S.foeHome, 40, d0, 0.45);
    const p1 = cine.orbitPos(side, S.foeHome, 44, d0 * 0.92, 0.35);
    const lookAt = (out: THREE.Vector3) => out.copy(base).setY(sig.root.position.y * 0.42 + S.stopY * 0.2);
    cine.cut(p0, lookAt(new THREE.Vector3()));
    const r = sc.rig;
    const tok = r.claim();
    void sc.tw.to(DROP, (k) => {
      if (!r.owns(tok)) return;
      r.pos.lerpVectors(p0, p1, ease.inQuad(k));
      lookAt(r.look);
    }, ease.linear, 'world');
    sc.vfx.emit({ pos: S.foeHome.clone().setY(0.2), count: low(c) ? 10 : 24, color: [0x8d846f, 0xb9a88a], speed: [0.5, 1.5], dir: UP, spread: 1, life: [0.4, 0.8], size: [0.2, 0.4], radius: S.Rs, drag: 1, intensity: 0.5 });
  }, [], FLY);
  tl.fromTo(sig.st, { drop: 0 }, { drop: 1, duration: DROP, ease: 'power3.in' }, FLY);
  tl.set({}, {}, FLY + DROP);
  await playTimeline(tl);
}

/** Impact: the seal squashes, vermilion light strikes the ground, a vermilion seal and seal patterns; the cage and giant seal break into golden light that flows back to the forehead; the camera retreats then pulls back to the wide shot */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe } = c;
  const m = mem(c);
  const S = spec(c);
  const { hf, R, foeHome } = S;
  const sig = m.sigil;
  const cage = m.cage;
  const lo = low(c);
  const foeC = sc.center(foe);
  const port = sc.portrait;
  // The director's white flash is replaced with vermilion (quietHit has already turned off the generic VFX)
  sc.stage.screenFlash(0xff9a6a, 0.28, 7);
  sc.stage.chromatic(0.6);
  snd.stamp();
  sc.rig.addTrauma(0.7);
  // The director's white hit flash is replaced with vermilion (this hook runs after the director, so it can cover it)
  sc.slots[foe].creature?.setFlash(VERMILION, 0.55);
  const fx = sc.gs.timeline('fx');
  if (sig) {
    fx.to(sig.st, { squash: 1, duration: 0.05, ease: 'power2.out' }, 0);
    fx.to(sig.st, { squash: 0, duration: 0.35, ease: 'elastic.out(1, 0.4)' }, 0.06);
    fx.to(sig.st, { heat: 1.4, duration: 0.05 }, 0);
  }
  if (cage) {
    fx.to(cage.st, { heat: 1.3, duration: 0.05 }, 0);
    fx.to(cage.st, { heat: 0.5, duration: 0.4 }, 0.1);
  }
  // Vermilion light: a beam of light from the seal face to the ground (bright at the edge, see-through in the middle, so the opponent can be seen clearly inside)
  {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(VERMILION).multiplyScalar(1.6) }, uA: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          float f = 1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
          float a = (pow(max(f, 0.0), 2.0) * 0.9 + 0.08) * (0.55 + 0.45 * vUv.y) * uA;
          gl_FragColor = vec4(uCol * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true), mat);
    col.position.copy(foeHome).setY(S.stopY / 2);
    col.scale.set(S.Rc, S.stopY, S.Rc);
    void sc.vfx.spawn(col, 0.5, (k) => {
      mat.uniforms.uA.value = (1 - k) * (1 - k);
      col.scale.x = col.scale.z = S.Rc * (0.85 + 0.35 * ease.outCubic(k));
    });
  }
  // On the ground: dark paper, golden seal patterns, the vermilion seal, cracks (kept through the afterglow)
  const paper = new THREE.Mesh(new THREE.CircleGeometry(S.Rs * 1.1, 48), new THREE.MeshBasicMaterial({ color: 0x12080a, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
  paper.rotation.x = -PI / 2;
  paper.position.copy(foeHome).setY(0.045);
  void sc.vfx.spawn(paper, 2.6, (k) => ((paper.material as THREE.MeshBasicMaterial).opacity = 0.6 * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3)));
  void sc.vfx.decal(foeHome.clone().setY(0.06), runeCircleTex(4), GOLD, S.Rs * 2.1, 2.6, 0, 0.9);
  void sc.vfx.decal(foeHome.clone().setY(0.07), sealTex(), 0xffffff, S.Rc * 1.7, 2.6, -0.12, 1.2);
  void sc.vfx.decal(foeHome.clone().setY(0.055), crackTex(5), 0x2a1a20, S.Rs * 2.6, 2.4, undefined, 0.8);
  // Shockwave ring: cinnabar on the inside, gold on the outside, flat on the ground
  for (const [col, I, r1, dur] of [[VERMILION, 0.9, 2.0, 0.55], [GOLD, 0.75, 3.2, 0.75]] as const) {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), additive(col, ringTex(), I));
    ring.rotation.x = -PI / 2;
    ring.position.copy(foeHome).setY(0.1);
    void sc.vfx.spawn(ring, dur, (k) => {
      ring.scale.setScalar(S.Rc * (0.4 + r1 * ease.outCubic(k)));
      (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    });
  }
  sc.vfx.smoke({ pos: foeHome.clone().setY(0.2), count: lo ? 20 : 40, color: [0x6b5030, 0xb59a6a], speed: [2, 5], dir: UP, spread: 1.4, life: [0.5, 0.9], size: [0.3, 0.6], sizeEnd: 0.9, gravity: -0.5, drag: 2.5, radius: S.Rc * 0.8 });
  sc.vfx.emit({ pos: foeC, count: lo ? 20 : 40, color: [GOLD, INK, VERMILION], speed: [2, 6], life: [0.5, 1.0], size: [0.05, 0.1], sizeEnd: 0.02, radius: S.Rc * 0.6, gravity: -2.5, drag: 1.6, intensity: 0.8 });
  void sc.vfx.debris(foeHome.clone().setY(0.1), GOLD_S, lo ? 6 : 12, 6, 1.2, 0.12, 1);
  cine.shock(foeC, 1.3, 0.7, 1.2);
  if (ev.hitIndex < ev.hits) return;
  sfx.impactBig();
  cine.track(() => sc.center(foe), ['vig', 'radial']);
  void cine.pulse({ tint: 0xa88478, lift: 0x2a0802, desat: 0, vignette: 0.95, radial: 0.85, lines: 0 }, { tint: 0xa9a2c4, lift: 0x06030c, vignette: 0.8, radial: 0 }, 0.6);

  const wt = sc.gs.timeline('world');
  // Camera: holds the target-view composition, then retreats back and up a little
  wt.call(() => {
    const r = sc.rig;
    const look = r.look.clone().add(new THREE.Vector3(0, hf * 0.2, 0));
    const pos = look.clone().add(r.pos.clone().sub(r.look).multiplyScalar(1.25)).add(new THREE.Vector3(0, hf * 0.35, 0));
    void cine.look({ fov: port ? 1.3 : 1.1, lines: 0 }, 0.8);
    void cine.shot(pos, look, 0.9, ease.outCubic);
  }, [], 0.3);
  // The giant seal and cage break into golden light and flow back to the old dragon's forehead
  wt.call(() => {
    playOr(dissolveUrl, () => ultSfx.shing(0.9), { gain: 1.2 });
    const brow = browPos(c);
    const n = lo ? 8 : 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      const from = foeHome.clone().add(new THREE.Vector3(Math.cos(a) * S.Rc, S.hoopY[0] * (0.3 + 0.7 * hash(i)), Math.sin(a) * S.Rc));
      void c.wait(i * 0.02).then(() => sc.vfx.projectile(from, brow, i % 2 ? GOLD : GOLD_HI, 0.28, 0.5 + hash(i + 3) * 0.12, 0.5 + hash(i) * 0.6, true));
    }
    // Scattering: the giant seal's outer ring and the cage's two gold rings turn into golden specks, ring by ring
    const rings: [number, number][] = [[S.stopY, R * S.sEnd], [S.hoopY[0], S.Rc], [S.hoopY[1], S.Rc * 1.08]];
    for (const [y, r] of rings) {
      const k = lo ? 10 : 20;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * PI * 2;
        sc.vfx.emit({ pos: foeHome.clone().add(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)), count: 3, color: [GOLD, GOLD_HI, INK], speed: [0.3, 1.2], dir: UP, spread: 0.8, life: [0.5, 0.9], size: [0.04, 0.09], gravity: 1.2, drag: 1.5, intensity: 0.9, atlas: 1 });
      }
    }
    sc.vfx.emit({ pos: foeHome.clone().setY(S.hoopY[0] * 0.6), count: lo ? 40 : 90, color: [GOLD, GOLD_HI, INK], speed: [0.5, 2], dir: UP, spread: 1, life: [0.5, 1.0], size: [0.04, 0.1], radius: S.Rs * 0.8, gravity: 0.8, drag: 1.4, intensity: 0.9, atlas: 1 });
  }, [], 0.45);
  if (sig) wt.to(sig.st, { dissolve: 1, duration: 0.45, ease: 'power2.in' }, 0.45);
  if (cage) {
    wt.to(cage.st, { dissolve: 1, duration: 0.45, ease: 'power2.in' }, 0.5);
    wt.to(cage.st, { cols: 0, duration: 0.3 }, 0.45);
  }
  // The forehead flashes: the pact returns to the forehead
  wt.call(() => {
    const b = browPos(c);
    void sc.vfx.glint(b.addScaledVector(sc.stage.camera.position.clone().sub(b).normalize(), S.h * 0.1), GOLD_HI, S.h * 0.3, 0.5, 3);
    ultSfx.shing(0.8);
  }, [], 1.0);
  wt.call(() => settleDusk(c, 0.55), [], 1.0);
}

/**
 * Wrap up the cinematic's post-processing and ease the sky color back by half; after holding for hold seconds the camera pulls back to the wide shot, where the post-hit battle text is read.
 * The sky dome fades out only at after, and the color is finally brought back by the safety net.
 */
function settleDusk(c: UltCtx, hold: number): void {
  const { sc, cine } = c;
  void cine.look({ lines: 0, radial: 0, haze: 0, isolate: 0, grain: 0, bloom: sc.stage.bloomBase * 0.85, tint: 0xc9c4dc, lift: 0x000000, desat: 0.08, vignette: 0.5 }, 0.6);
  void c.wait(hold).then(() => {
    cine.track(null);
    void sc.rig.reset(0.8);
    void cine.look({ fov: 1, roll: 0 }, 0.8);
  });
}

/** Remove the giant seal and cage (after a miss or a block) */
function breakAll(c: UltCtx, dur: number): void {
  const m = mem(c);
  const tl = c.sc.gs.timeline('world');
  if (m.sigil) tl.to(m.sigil.st, { dissolve: 1, duration: dur, ease: 'power2.in' }, 0);
  if (m.cage) tl.to(m.cage.st, { dissolve: 1, cols: 0, duration: dur, ease: 'power2.in' }, 0);
}

/** Blocked (the ultimate ignores guard, so in theory this does not happen): the giant seal hits the barrier, bounces up and scatters, and the cage falls apart */
async function guarded(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  void ultGuarded(c);
  if (m.sigil) {
    const tl = sc.gs.timeline('world');
    tl.to(m.sigil.st, { drop: 0.7, duration: 0.25, ease: 'power2.out' }, 0);
    await playTimeline(tl);
  }
  sc.rig.addTrauma(0.3);
  sc.vfx.emit({ pos: sc.center(c.foe), count: 40, color: [GOLD, INK], speed: [1, 4], life: [0.4, 0.8], size: [0.04, 0.1], radius: 1, gravity: -2, intensity: 0.8 });
  breakAll(c, 0.35);
  await c.wait(0.4);
}

function settleOwn(c: UltCtx): void {
  breakAll(c, 0.35);
  settleDusk(c, 0.5);
}

/** Afterglow: wings fold, mouth closes, head lowers, the pact sigil returns to normal; the sky dome fades out and all VFX objects are removed */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  const A = act(c);
  const tl = sc.gs.timeline('world');
  const to: Record<string, number> = {};
  for (const k of ACTS) if (k in A) to[k] = 0;
  tl.to(A, { ...to, duration: 0.5, ease: 'power2.inOut' }, 0);
  if (m.sky) tl.to(m.sky.fade, { k: 0, duration: 0.6, ease: 'power1.inOut' }, 0);
  tl.call(() => void c.cine.look({ tint: 0xe2dff0, desat: 0.04 }, 0.6), [], 0);
  tl.set({}, {}, 0.62);
  await playTimeline(tl);
  for (const k of ACTS) if (k in A) A[k] = 0;
  m.sigil?.kill();
  m.cage?.kill();
  m.sky?.kill();
  m.brow?.kill();
  m.sigil = m.cage = m.sky = m.brow = undefined;
}

export default defineSsr({
  windup,
  deliver,
  impact,
  quietHit: true,
  guarded,
  settle: settleOwn,
  after,
});
