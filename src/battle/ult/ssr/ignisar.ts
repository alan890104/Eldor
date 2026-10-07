// Ignisar, the Blazing King: "Corona Roar"
//
// What this cinematic is about: the lion king crowns itself with a roar. The mane flames burn from the current flame hue all the way up to azure flame, and a golden corona rises behind it (the same shape as the golden crown on its head),
// the corona locks the azure flame in, and the roar turns into a torrent of azure sun-flame that engulfs the opponent, a ring of basalt corona seal bursting out at the opponent's feet; finally the corona shrinks into a beam of light and drops back onto the golden crown (the "Corona" status, three turns).
//
// Model: src/render/lab/ignisarModel.ts. Action weights used: focus (face forward), crouch (lower the front body, head down), roar (mouth open, head raised, chest out; together with crouch it is a level-eyed breath),
// flare (mane flames spread outward and dart), hue (flame hue 0 crimson, 1 white, 2 azure; the flame fur on the model really changes color), glow (source crystal, flame ridge, the ruby on the crown brighten).
// Positions come only from anchors and the shell: sc.head, sc.eyes, anchor('mouth'/'mane'/'crown'/'crownGem'/'pendant'/'pawFL'/'pawFR'); the legacy model falls back to estimates,
// and the flame hue changes the legacy model's glows colors.
// The corona ring and corona seal are solid scene objects (sceneMaterial + outline layer, heavy lines); flames, glow, embers and shockwaves go through VFX. The spirit itself does not take bloom.
// Flame hue mechanic: at the opening the mane first shows the flame hue at the moment of casting (the "Flame Hue" marker on the use event), then climbs step by step to azure flame: crimson flame climbs two steps, white flame one step, and if it is already azure flame it is a single surge.
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed)
//   windup
//     0.00  The blazing sun sets: letterbox, the music is pulled out, the sky pressed to a dark red dusk (the arena effects pause and the atmosphere is rewritten), the rim light turns firelight orange. The camera at audience side 46°,
//           shooting up from below the head at the face and mane (low-angle close-up), pushes in, orbits to 26° and slowly rises to nearly head height within 1.45 s. It faces the opponent, front body crouched, tail lashing (focus, crouch).
//           Embers on the ground drift upward, flame tongues of the current flame hue lick out of the mane, and a ring of flame glow sits behind the mane (the middle blocked by the head and mane, so it does not cover the face). Sound: a volcano's low rumble and the crackle of fire.
//     0.30  Forepaws press the ground: glowing ground fissures split open under the two forepaws, throwing up dust. Sound: one low-frequency hit.
//     0.40  Eyes open: eye glints of the current flame hue, the source crystal and flame ridge light up (glow).
//     0.62 to 1.02  Flame hue climbs (crimson flame climbs two steps: 0.62, 1.02; white flame one step: 0.85; azure flame: surge at 0.85): at each step the mane flames spread outward (flare), the flame fur on the model changes to
//           the next color (hue), flame tongues burst out of the mane, a shockwave rings the head, and the color temperature of the frame turns with it (warm → neutral → cool), the sky and rim light together turning to a blue night. Sound: a great fire roaring up.
//     1.45  Coronation (cut): audience side 16°, a ground-level low-angle full-body shot with the sky as backdrop; the ground behind it splits open and a golden corona ring rises, turning as it goes (sixteen flame-shaped rays unfold in sequence),
//           the camera slowly pushes in and tilts up following the corona. It straightens its front body (crouch eases back). Sound: the rumble of the corona breaking through the ground.
//     1.82  Corona lock: the corona stops directly behind the lion's head (from this camera position it exactly frames the head), azure flame ignites on the ring, embers rain down, and the ruby on the golden crown flashes. Sound: one huge gong.
//     1.98  Roar: the camera pushes sharply to in front of the face, pressed down to about eye height (the corona still frames the head, with the corona and azure flame behind it filling the background), it opens its mouth and throws back its head (roar), mane flames fully open (flare);
//           the corona pushes out two shockwave rings, radial blur, speed lines, dust on the ground blown away, the corona's flames surge. Sound: a lion's roar (loudest around 2.1).
//     2.45  End (holding at the peak of the roar)
//   deliver
//     0.00  Sun-flame torrent (cut): side-on follow shot. It lowers its head and opens its mouth level (roar + crouch), and a stream of azure flame sprays from its mouth toward the opponent (cel-shaded: dark blue tongues, pale blue body, white flame core,
//           so it does not wash out to white even over a bright background); the corona's fire draws in toward its body.
//           The camera slides forward on the audience side alongside the leading edge of the flame stream, the ground splitting open along the way and rocks leaping up. Sound: the whoosh of the flame stream.
//     0.55  Target's view (cut): behind the opponent, audience side 58°, slightly high: the opponent at front right, Ignisar and the corona behind it at back left, the flame stream sweeping across the frame (all three in one frame). The camera slowly pushes in.
//     1.05  The flame stream arrives (handed to the director to play the impact)
//   impact (quietHit: the impact visuals are made by itself; pinFoe: the opponent is trapped in the corona seal and not knocked back)
//     0.00  Azure flame engulfs: a pale blue-white flash, the opponent flashes blue-white, a ring of azure flame leaps up on its body, a ring of shockwave and burned cracks on the ground; the flame stream flares once more and then recedes.
//           Twelve basalt columns burst out of the ground around the opponent (the corona seal), burning blue when they first emerge and slowly cooling back to black, with azure flame darting at their roots; the frame is pushed to cold blue and then eases back. Sound: a fireball explosion, a heavy hit.
//     0.30  The camera retreats back and up 1.25x from the target's view.
//     0.85  Coronation finish (cut): audience side 38°, a three-quarter medium shot, the camera slowly pushing in.
//     0.95  The corona ring shrinks into a beam of light and flies back to the lion king's golden crown, and the crown flashes (the battle text for the "Corona" status, three turns, appears right here).
//     1.60  Post-processing eases back, pull back to the wide shot.
//   guarded: the flame stream hits the barrier, the flames splash outward around the barrier and the stream recedes, and the corona seal does not appear; then the shared "barrier almost shattered, finally holds".
//   after: weights go to zero and the mane slowly returns to its original color; the rock columns shrink back into the ground, and if the corona is still there it is taken back into the golden crown; sky, fog and rim light return to normal, and the arena effects take over the atmosphere.

import * as THREE from 'three';
import { playOr, preloadSamples } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import blastUrl from '../../../audio/sfx/ignisar-blast.mp3';
import coronaUrl from '../../../audio/sfx/ignisar-corona.mp3';
import igniteUrl from '../../../audio/sfx/ignisar-ignite.mp3';
import roarUrl from '../../../audio/sfx/ignisar-roar.mp3';
import rumbleUrl from '../../../audio/sfx/ignisar-rumble.mp3';
import torrentUrl from '../../../audio/sfx/ignisar-torrent.mp3';
import { crackTex } from '../../../render/fxtex.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { inkScenery } from '../../../render/ink.ts';
import { flameTooth } from '../../../render/lab/ignisarModel.ts';
import { brilliant, lathe, slab } from '../../../render/lab/shapes.ts';
import { sceneMaterial, type SpiritMaterial } from '../../../render/spiritToon.ts';
import { LIGHT } from '../../../render/toon.ts';
import { ease } from '../../../render/tween.ts';
import type { FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, settle } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [rumbleUrl, igniteUrl, coronaUrl, roarUrl, torrentUrl, blastUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

/** VFX colors of the three flame hues: [main color, bright color, flame core] */
const HUES: [number, number, number][] = [
  [0xff4a14, 0xff9a2a, 0xffe07a],
  [0xffd890, 0xfff0d0, 0xffffff],
  [0x2f7dff, 0x8fd0ff, 0xe8f6ff],
];
/** Screen tint of each flame hue */
const GRADE = [0xffd8bc, 0xfff4ec, 0xe6ecff];
const BLUE = HUES[2][0];
const BLUE_HI = HUES[2][1];
const BLUE_CORE = HUES[2][2];
const GOLD = 0xe8b64a;
const BASALT = 0x5e4a44;
const DUST = [0x5a4038, 0x7a5a48, 0x3e2c26];
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};

// Timetable (seconds): each beat of the shot list; the seconds in the file header match these
const T = {
  crack: 0.3,
  glint: 0.4,
  /** Flame hue climbing: crimson flame climbs two steps, white flame one step (or azure flame surges) */
  steps2: [0.62, 1.02],
  steps1: [0.85],
  corona: 1.45,
  lock: 1.82,
  roar: 1.98,
  windup: 2.45,
  target: 0.55,
  deliver: 1.05,
  /** After the impact */
  pull: 0.3,
  /** Cut to the medium shot of the coronation finish */
  crownCut: 0.85,
  crown: 0.95,
  settle: 1.6,
};

// ───────────────────────── State ─────────────────────────

interface Geo {
  h: number;
  hf: number;
  /** The horizontal direction from the caster toward the opponent, and the horizontal direction of the audience side */
  f: THREE.Vector3;
  a: THREE.Vector3;
  home: THREE.Vector3;
  foe: THREE.Vector3;
  /** The camera position of the coronation shot (the corona ring faces it) */
  camSig: THREE.Vector3;
  /** The corona ring's center, normal (facing the coronation camera position), and inner radius */
  ringC: THREE.Vector3;
  ringN: THREE.Vector3;
  ringR: number;
  /** Radius of the corona seal (the ring of rock columns) */
  sealR: number;
}

interface Corona {
  root: THREE.Group;
  /** rise: rising, rays: rays unfolding, fire: azure flame on the ring, blaze: surging during the roar, feed: drawing in toward the lion king, crown: shrinking back into the golden crown */
  st: { rise: number; rays: number; fire: number; blaze: number; feed: number; crown: number };
  kill(): void;
}

interface Aura {
  st: { a: number; len: number };
  kill(): void;
}

interface Beam {
  /** k: how far along the path the leading edge has gone; a: overall brightness (fades out after the impact) */
  st: { k: number; a: number };
  head(): THREE.Vector3;
  kill(): void;
}

interface Seal {
  st: { k: number; burn: number };
  kill(): void;
}

interface Sky {
  st: { k: number; cold: number };
  restore(): void;
  kill(): void;
}

interface Mem {
  h0: number;
  /** The flame hue currently shown (the VFX colors follow it) */
  hue: number;
  g?: Geo;
  mats: THREE.Material[];
  layers: FxLayer[];
  ring?: Corona;
  aura?: Aura;
  beam?: Beam;
  seal?: Seal;
  sky?: Sky;
  crowned: boolean;
  /** The legacy model's glowing parts (the flame hue changes their colors) */
  oldGlows?: { mats: THREE.MeshBasicMaterial[]; orig: THREE.Color[] };
  offCleanup?: () => void;
}
const mem = (c: UltCtx): Mem => (c.mem.ign ??= { h0: 1, hue: 1, mats: [], layers: [], crowned: false }) as Mem;
const creature = (c: UltCtx) => c.sc.slots[c.side].creature;
/** The lion king's action weights (only effective on the experimental model) */
const act = (c: UltCtx): Record<string, number> => creature(c)?.act ?? {};
const low = (c: UltCtx): boolean => c.sc.stage.quality === 'low';

/** The flame hue at the moment of casting (the "Flame Hue" marker of the use event): 0 crimson flame, 1 white flame, 2 azure flame */
function readHue(c: UltCtx, view = c.view): number {
  const sd = view.sides[c.side];
  const note = sd.team[sd.active]?.marks?.find((x) => x.id === 'kit:hue')?.note ?? '白焰';
  return note.startsWith('蒼') ? 2 : note.startsWith('白') ? 1 : 0;
}

/** World position of an anchor; use fallback when the legacy model has no such anchor */
function anchorPos(c: UltCtx, name: string, fallback: () => THREE.Vector3): THREE.Vector3 {
  const cr = creature(c);
  const a = cr?.anchor(name);
  if (!cr || !a) return fallback();
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}

const mouthPos = (c: UltCtx): THREE.Vector3 => {
  const g = mem(c).g;
  return anchorPos(c, 'mouth', () => c.sc.head(c.side).addScaledVector(g?.f ?? c.cine.forward(c.side), (g?.h ?? 1.5) * 0.14));
};
const manePos = (c: UltCtx): THREE.Vector3 => anchorPos(c, 'mane', () => c.sc.head(c.side));

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
  const head = sc.head(side);
  // The coronation camera position: audience side 16°, a ground-level shot looking up at the full body; the corona ring is placed where the line of sight "camera position → head" extends backward, and from here it exactly frames the head
  const camSig = cine.orbitPos(side, home, 16, fitDist(c, h * 1.75, h * 1.6, 1) + h * 0.2, 0).setY(h * 0.2);
  const d = head.clone().sub(camSig).normalize();
  const ringC = head.clone().addScaledVector(d, h * 1.15);
  return { h, hf, f, a, home, foe: foeHome, camSig, ringC, ringN: d.clone().negate(), ringR: h * 0.52, sealR: Math.max((fc?.width ?? 1) * 0.5, hf * 0.32) + 0.55 };
}

// ───────────────────────── Flame hue ─────────────────────────

/** Legacy model: the glowing parts change to the i-th flame hue (the new model changes act.hue, so this does nothing) */
function recolorOld(c: UltCtx, i: number): void {
  const m = mem(c);
  const cr = creature(c);
  if (!cr || cr.lab) return;
  m.oldGlows ??= { mats: [...cr.glows], orig: cr.glows.map((x) => x.color.clone()) };
  const [col, , core] = HUES[i];
  const a = new THREE.Color(col);
  const b = new THREE.Color(core);
  m.oldGlows.mats.forEach((x, j) => {
    const o = m.oldGlows!.orig[j];
    if (i === 0) {
      x.color.copy(o);
      return;
    }
    const lum = Math.max(o.r, o.g, o.b) * (i === 1 ? 0.55 : 1);
    const t = clamp01((o.g / Math.max(o.r, 1e-3) - 0.3) / 0.6);
    x.color.lerpColors(a, b, t).multiplyScalar(lum);
  });
}

function restoreOld(c: UltCtx): void {
  const g = mem(c).oldGlows;
  g?.mats.forEach((x, j) => x.color.copy(g.orig[j]));
}

// ───────────────────────── Sky color ─────────────────────────

/**
 * Sky, fog, main light and cartoon light (LIGHT): k goes from daytime to dusk, and cold turns the dusk's dark red into the blue night of azure flame.
 * The arena effects rewrite the atmosphere every frame, so fieldFx.hold during the cinematic; it is rewritten once per frame on the effects layer, and restored at after and on leaving the battle.
 */
function makeSky(c: UltCtx): Sky {
  const { sc } = c;
  const A = sc.arena;
  const u = A.skyMat?.uniforms;
  const day = {
    sky: u ? [u.top.value.clone(), u.mid.value.clone(), u.bot.value.clone()] as THREE.Color[] : [],
    fog: A.fog.color.clone(),
    ambient: LIGHT.ambient.value.clone(),
    rim: LIGHT.rimColor.value.clone(),
    shadow: LIGHT.shadowTint.value.clone(),
    sun: A.sun.intensity,
    hemi: A.hemi.intensity,
  };
  const col = (x: number) => new THREE.Color(x);
  const DUSK = { sky: [0x1c0710, 0x5a1a10, 0xb8461c].map(col), fog: col(0x3a160c), ambient: col(0x9a6450), rim: col(0xffa060), shadow: col(0x5a2014) };
  const COLD = { sky: [0x050a26, 0x12286e, 0x3c68c4].map(col), fog: col(0x0e1a44), ambient: col(0xa0948e), rim: col(0x9cd4ff), shadow: col(0x2a2a5a) };
  const tmp = new THREE.Color();
  const st = { k: 0, cold: 0 };
  const mix = (d: THREE.Color, a: THREE.Color, b: THREE.Color, out: THREE.Color) => out.copy(d).lerp(tmp.lerpColors(a, b, st.cold), st.k * 0.85);
  const apply = () => {
    if (sc.disposed) return;
    if (u) for (let i = 0; i < 3; i++) mix(day.sky[i], DUSK.sky[i], COLD.sky[i], u[['top', 'mid', 'bot'][i]].value as THREE.Color);
    mix(day.fog, DUSK.fog, COLD.fog, A.fog.color);
    mix(day.ambient, DUSK.ambient, COLD.ambient, LIGHT.ambient.value);
    mix(day.rim, DUSK.rim, COLD.rim, LIGHT.rimColor.value);
    mix(day.shadow, DUSK.shadow, COLD.shadow, LIGHT.shadowTint.value);
    A.sun.intensity = THREE.MathUtils.lerp(day.sun, day.sun * 0.6, st.k);
    A.hemi.intensity = THREE.MathUtils.lerp(day.hemi, day.hemi * 0.65, st.k);
  };
  sc.fieldFx.hold = true;
  const layer = sc.vfx.layer(new THREE.Object3D(), () => apply());
  const restore = () => {
    st.k = 0;
    st.cold = 0;
    apply();
    sc.fieldFx.hold = false;
  };
  return { st, restore, kill: () => layer.kill() };
}

// ───────────────────────── Corona ring (solid) ─────────────────────────

/** The flames behind the corona ring (additive, lying on the ring plane): azure flame darting between the rays, and a faint ring of light inside the ring */
function coronaFireMat(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(0x1c48d0) }, uHi: { value: new THREE.Color(BLUE_HI) }, uT: { value: 0 }, uA: { value: 0 }, uLen: { value: 1 }, uRi: { value: 0.4 }, uRo: { value: 0.5 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uHi; uniform float uT; uniform float uA; uniform float uLen; uniform float uRi; uniform float uRo;
      varying vec2 vUv;
      float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        // Flame tongues: 3D noise on the torus curls outward along the radius and gets thinner farther out; dark gaps are left between the tongues
        float d = max(r - uRo, 0.0) / max(uLen * (1.0 - uRo), 1e-3);
        vec3 q = vec3(cos(a) * 3.2, sin(a) * 3.2, r * 7.0 - uT * 1.8);
        float n = n3(q) * 0.6 + n3(q * 2.3 + 5.1) * 0.4;
        float out1 = smoothstep(uRo - 0.03, uRo, r);
        float flame = smoothstep(0.2, 0.3, n - d * 0.75) * out1;
        float root = (1.0 - smoothstep(0.0, 0.2, d)) * out1;
        float inner = smoothstep(uRi * 0.6, uRi, r) * (1.0 - smoothstep(uRi, uRo, r)) * 0.12;
        float edge = exp(-abs(r - uRo) * 45.0);
        float fade = 1.0 - smoothstep(0.9, 1.0, r);
        vec3 col = mix(uCol, uHi, clamp(edge + root * 0.6, 0.0, 1.0));
        float alpha = (flame * (0.5 + 0.2 * root) + inner + edge * 0.35) * fade * uA;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.62));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * The golden corona ring: a beveled ring band, a thin ring on the inner side, sixteen flame-shaped rays (alternating long and short, the same kind of crown teeth as the golden crown on its head), with a sapphire set under each long ray.
 * The rays are an InstancedMesh (each unfolds on its own), and the outline is still drawn. Behind the ring is a sheet of additive azure flame.
 */
function makeCorona(c: UltCtx, g: Geo): Corona {
  const { sc } = c;
  const m = mem(c);
  const R = g.ringR;
  const Ro = R * 1.16;
  const root = new THREE.Group();
  const spin = new THREE.Group();
  root.add(spin);
  const gold = sceneMaterial(GOLD, { surface: 'metal', rim: 0.55 });
  const gem = sceneMaterial(0x4f8cff, { surface: 'gem', rim: 0.4, emissive: 0x2a60ff, emissiveAmt: 0.35 });
  m.mats.push(gold, gem);
  // Ring band: the cross-section is a beveled flat rectangle, lathed around y and then rotated into the xy plane (normal +z)
  const w = R * 0.08;
  const band = lathe([[R, -w], [R + w * 0.3, -w * 1.25], [Ro - w * 0.3, -w * 1.25], [Ro, -w], [Ro, w], [Ro - w * 0.3, w * 1.25], [R + w * 0.3, w * 1.25], [R, w], [R, -w]], 96);
  band.rotateX(Math.PI / 2);
  band.computeVertexNormals();
  spin.add(new THREE.Mesh(band, gold));
  const inner = new THREE.TorusGeometry(R * 0.93, R * 0.028, 8, 96);
  spin.add(new THREE.Mesh(inner, gold));
  // Rays: alternating long and short
  const N = 16;
  const longG = slab(flameTooth(R * 0.16, R * 0.95), R * 0.09, R * 0.02, 3);
  const shortG = slab(flameTooth(R * 0.12, R * 0.55), R * 0.08, R * 0.018, 3);
  const rays = [new THREE.InstancedMesh(longG, gold, N / 2), new THREE.InstancedMesh(shortG, gold, N / 2)];
  const gemG = brilliant(R * 0.075, R * 0.05, R * 0.06, 10);
  const gems = new THREE.InstancedMesh(gemG, gem, N / 2);
  for (const x of [...rays, gems]) {
    x.frustumCulled = false;
    spin.add(x);
  }
  // The azure flame behind the ring
  const fireMat = coronaFireMat();
  const Rf = R * 2.35;
  fireMat.uniforms.uRi.value = R / Rf;
  fireMat.uniforms.uRo.value = Ro / Rf;
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(Rf * 2, Rf * 2), fireMat);
  fire.position.z = -R * 0.12;
  fire.renderOrder = 3;
  root.add(fire);
  inkScenery(root, { heavy: true });

  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), g.ringN);
  root.quaternion.copy(q);
  const st = { rise: 0, rays: 0, fire: 0, blaze: 0, feed: 0, crown: 0 };
  const M = new THREE.Matrix4();
  const P = new THREE.Vector3();
  const Q = new THREE.Quaternion();
  const S = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const drop = Ro + R * 0.95 + 0.5;
  let spinA = 0;
  let t = 0;
  const layer = sc.vfx.layer(root, (dt) => {
    t += dt;
    // Rising: rises from underground turning, turning slower the closer it gets to its place; once in place it slowly spins on its own (faster during the roar and when the fire is drawn in)
    const e = st.rise;
    spinA += dt * (0.25 + st.blaze * 1.2 + st.feed * 2.2);
    spin.rotation.z = (1 - e) * Math.PI * 1.6 + spinA;
    root.position.copy(g.ringC).addScaledVector(UP, -(1 - e) * drop);
    // Shrinking back to the golden crown: shrinks all the way as it flies toward the golden crown
    if (st.crown > 0) {
      const to = anchorPos(c, 'crown', () => sc.head(c.side).addScaledVector(UP, g.h * 0.12));
      root.position.lerp(to, ease.inOutQuad(st.crown));
    }
    root.scale.setScalar(Math.max(1e-3, 1 - st.crown * 0.97));
    root.visible = e > 0.001 && st.crown < 0.999;
    // The rays unfold in sequence (with a rebound) and push outward during the roar
    for (let i = 0; i < N; i++) {
      const j = i >> 1;
      const long = i % 2 === 0;
      const th = (i / N) * TAU + Math.PI / 2;
      const k = clamp01(st.rays * 1.7 - (i / N) * 0.7);
      const s = ease.outBack(k) * (1 + st.blaze * (long ? 0.14 : 0.08) * (0.8 + 0.2 * Math.sin(t * 19 + i)));
      P.set(Math.cos(th), Math.sin(th), 0).multiplyScalar(Ro - R * 0.02);
      Q.setFromAxisAngle(Z, th - Math.PI / 2);
      S.set(Math.max(1e-3, s), Math.max(1e-3, s), 1);
      rays[long ? 0 : 1].setMatrixAt(j, M.compose(P, Q, S));
      if (long) {
        P.set(Math.cos(th), Math.sin(th), 0).multiplyScalar(Ro + R * 0.2 * s);
        P.z = R * 0.05;
        S.setScalar(Math.max(1e-3, s));
        gems.setMatrixAt(j, M.compose(P, Q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), S));
      }
    }
    rays[0].instanceMatrix.needsUpdate = true;
    rays[1].instanceMatrix.needsUpdate = true;
    gems.instanceMatrix.needsUpdate = true;
    fireMat.uniforms.uT.value = t;
    fireMat.uniforms.uA.value = st.fire * (1 + st.blaze * 0.3) * (1 - st.crown);
    fireMat.uniforms.uLen.value = 0.55 + st.blaze * 0.45 + st.feed * 0.15;
    gem.uniforms.uEmissiveAmt.value = 0.35 + st.fire * 0.45;
  }, () => {
    band.dispose();
    inner.dispose();
    longG.dispose();
    shortG.dispose();
    gemG.dispose();
    fire.geometry.dispose();
    fireMat.dispose();
  });
  return { root, st, kill: () => layer.kill() };
}

// ───────────────────────── Flame glow of the mane ─────────────────────────

/** A ring of flame facing the camera behind the mane (additive, depth-tested: the head and mane block the middle, leaving only the outer ring, so it does not cover the face); the color follows the current flame hue */
function makeAura(c: UltCtx): Aura {
  const { sc } = c;
  const m = mem(c);
  const h = m.g!.h;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color() }, uHi: { value: new THREE.Color() }, uT: { value: 0 }, uA: { value: 0 }, uLen: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uHi; uniform float uT; uniform float uA; uniform float uLen;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        // Flame tongues leap upward: long on the upper half of the ring, short on the lower half
        float n = 0.5 + 0.25 * sin(a * 7.0 - uT * 3.1) + 0.15 * sin(a * 12.0 + uT * 4.3) + 0.1 * sin(a * 23.0 - uT * 7.7);
        float up = 0.55 + 0.45 * max(p.y / max(r, 1e-3), 0.0);
        float r0 = 0.38;
        float len = max(uLen * n * up * 0.62, 1e-3);
        float d = (r - r0) / len;
        float lick = 0.7 + 0.3 * sin((r - uT * 0.9) * 30.0 + a * 5.0);
        float body = smoothstep(-0.25, 0.05, d) * (1.0 - smoothstep(0.2, 1.0, d)) * lick;
        vec3 col = mix(uHi, uCol, clamp(d, 0.0, 1.0));
        gl_FragColor = vec4(col, clamp(body * uA * 0.8, 0.0, 0.8));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.renderOrder = 2;
  const st = { a: 0, len: 1 };
  const cam = sc.stage.camera;
  const P = new THREE.Vector3();
  let t = 0;
  const layer = sc.vfx.layer(mesh, (dt) => {
    t += dt;
    const [col, hi] = hueCols(m.hue);
    mat.uniforms.uCol.value.copy(col);
    mat.uniforms.uHi.value.copy(hi);
    mat.uniforms.uT.value = t;
    mat.uniforms.uA.value = st.a * (low(c) ? 0.7 : 1);
    mat.uniforms.uLen.value = st.len;
    // Placed some distance behind the mane (away from the camera), with the head and mane blocking the middle
    P.copy(manePos(c));
    mesh.position.copy(P).addScaledVector(P.clone().sub(cam.position).normalize(), h * 0.22);
    mesh.quaternion.copy(cam.quaternion);
    mesh.scale.setScalar(h * 0.62 * (1 + (st.len - 1) * 0.25));
    mesh.visible = st.a > 0.01;
  }, () => {
    mesh.geometry.dispose();
    mat.dispose();
  });
  return { st, kill: () => layer.kill() };
}

/** Main and bright colors of the current flame hue (which can be an in-between value) */
const _c0 = new THREE.Color();
const _c1 = new THREE.Color();
function hueCols(hue: number): [THREE.Color, THREE.Color] {
  const i = Math.min(1, Math.floor(hue));
  const k = clamp01(hue - i);
  _c0.setHex(HUES[i][0]).lerp(new THREE.Color(HUES[i + 1][0]), k);
  _c1.setHex(HUES[i][1]).lerp(new THREE.Color(HUES[i + 1][1]), k);
  return [_c0, _c1];
}
const hueSet = (hue: number): [number, number, number] => HUES[Math.round(clamp01(hue / 2) * 2)];

// ───────────────────────── Azure flame (flame stream) ─────────────────────────

/**
 * Three layers of azure flame. The outer two layers are cel-shaded solid-color fire (normal blending, hard edges), consistent with the outline art style, and do not wash out to white over a bright background;
 * only the innermost core is additive light. kind 0 sparse dark blue flame tongues on the outer ring, 1 the body, 2 the core.
 */
const FLAME = [
  { col: 0x1a3fb8, hi: 0x2a62e8, th: 0.6, spd: 2.5, core: 0, fl: 0.92, add: false },
  { col: 0x2f7dff, hi: 0x86c8ff, th: 0.56, spd: 3.5, core: 0, fl: 0.95, add: false },
  { col: BLUE_HI, hi: BLUE_CORE, th: 0.5, spd: 5, core: 0.55, fl: 0.35, add: true },
] as const;

/**
 * Flames on a cylinder surface (uv.y is the flow direction, 0 at the root). 3D noise scrolls along the flow direction and leaves dark gaps, so it reads as individual flame tongues rather than a light tube.
 * uGrow is how far the leading edge has gone.
 */
function flameMat(kind: 0 | 1 | 2, k: number): THREE.ShaderMaterial {
  const F = FLAME[kind];
  return new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(F.col) },
      uHi: { value: new THREE.Color(F.hi) },
      uT: { value: 0 },
      uA: { value: 1 },
      uGrow: { value: 0 },
      uK: { value: k },
      uTh: { value: F.th },
      uSpd: { value: F.spd },
      uCore: { value: F.core },
      uFl: { value: F.fl },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uHi; uniform float uT; uniform float uA; uniform float uGrow; uniform float uK;
      uniform float uTh; uniform float uSpd; uniform float uCore; uniform float uFl;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      void main(){
        float s = vUv.y;
        if (s > uGrow) discard;
        float f = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float ang = vUv.x * 6.2831853;
        vec3 q = vec3(cos(ang) * 2.2, sin(ang) * 2.2, s * uK - uT * uSpd);
        float n = n3(q) * 0.62 + n3(q * 2.1 + 3.7) * 0.38;
        // Around the outline only places where the noise is high pass the threshold: the edge is ragged flame tongues, not the straight edge of a cylinder
        float v = n + f * 0.3 - smoothstep(uGrow - 0.08, uGrow, s) * 0.35;
        float flame = smoothstep(uTh, uTh + 0.04, v);
        float rootA = smoothstep(0.0, 0.03, s);
        float core = pow(max(f, 0.0), 2.5) * uCore;
        float a = (flame * uFl + core * (0.55 + 0.45 * flame)) * rootA * uA;
        vec3 col = mix(uCol, uHi, smoothstep(uTh + 0.12, uTh + 0.16, v) * 0.8 + core);
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    blending: F.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}

// ───────────────────────── Sun-flame torrent ─────────────────────────

/**
 * An azure stream of flame sprayed from the mouth, growing thicker toward the front: a bright core in the center (brightest on the side facing the camera) + a roiling outer ring of flames, a fireball at the leading edge.
 * The start follows the mouth every frame; k is where the leading edge has reached (0 mouth, 1 opponent).
 */
function makeBeam(c: UltCtx, to: THREE.Vector3): Beam {
  const { sc } = c;
  const m = mem(c);
  const g = m.g!;
  const from0 = mouthPos(c);
  const len0 = Math.max(1, from0.distanceTo(to));
  const r0 = g.h * 0.1;
  const r1 = g.hf * 0.36 + 0.32;
  const mk = (ra: number, rb: number, kind: 0 | 1 | 2) => {
    const geo = new THREE.CylinderGeometry(rb, ra, len0, 40, 24, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, len0 / 2);
    const x = new THREE.Mesh(geo, flameMat(kind, len0 / (r1 * [1.8, 1.3, 0.7][kind])));
    x.renderOrder = 3 + kind;
    return x;
  };
  const layers = [mk(r0 * 2.2, r1 * 1.3, 0), mk(r0 * 1.6, r1, 1), mk(r0 * 0.6, r1 * 0.24, 2)];
  const root = new THREE.Group();
  root.add(...layers);
  const grp = new THREE.Group();
  grp.add(root);
  const st = { k: 0, a: 1 };
  const lo = low(c);
  const H = new THREE.Vector3();
  const D = new THREE.Vector3();
  let t = 0;
  let acc = 0;
  const layer = sc.vfx.layer(grp, (dt) => {
    t += dt;
    const from = mouthPos(c);
    const len = Math.max(0.5, from.distanceTo(to));
    root.position.copy(from);
    root.lookAt(to);
    const w = 1 + Math.sin(t * 40) * 0.04;
    root.scale.set(w, w, len / len0);
    for (const x of layers) {
      const u = (x.material as THREE.ShaderMaterial).uniforms;
      u.uT.value = t;
      u.uGrow.value = Math.max(0.001, st.k);
      u.uA.value = st.a;
    }
    root.visible = st.k > 0.002 && st.a > 0.01;
    D.copy(to).sub(from).normalize();
    H.copy(from).lerp(to, st.k);
    // Clumps of fire and embers that roll off the leading edge, flung forward along the flame stream
    if (st.k <= 0.002 || st.a < 0.3) return;
    const rr = THREE.MathUtils.lerp(r0, r1, st.k);
    acc += dt * (lo ? 12 : 28) * st.a;
    const n = Math.floor(acc);
    if (!n) return;
    acc -= n;
    sc.vfx.emit({ pos: H, count: n, color: [0x1a3fb8, BLUE], speed: [1.5, 5], dir: D, spread: 0.8, life: [0.15, 0.3], size: [rr * 0.2, rr * 0.4], sizeEnd: 0.4, radius: rr * 0.7, drag: 2.5, intensity: 0.35 });
  }, () => {
    for (const x of layers) {
      x.geometry.dispose();
      (x.material as THREE.Material).dispose();
    }
  });
  return { st, head: () => H.clone(), kill: () => layer.kill() };
}

// ───────────────────────── Corona seal (solid) ─────────────────────────

/** A faceted volcanic rock column: a pentagonal pyramid, each face with its own normal, the tip leaning to one side */
function spikeGeo(): THREE.BufferGeometry {
  const g = lathe([[0.001, -0.25], [1, 0], [0.86, 0.3], [0.5, 0.72], [0.001, 1]], 5).toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + p.getY(i) * 0.28);
  g.computeVertexNormals();
  return g;
}

/** A ring of basalt columns bursting out at the opponent's feet (leaning outward), azure flame darting at the roots; k rises (with a rebound) and shrinks back into the ground at 0 */
function makeSeal(c: UltCtx): Seal {
  const { sc } = c;
  const m = mem(c);
  const g = m.g!;
  const lo = low(c);
  const n = lo ? 8 : 12;
  const geo = spikeGeo();
  const mat = sceneMaterial(BASALT, { rim: 0.7, emissive: BLUE, emissiveAmt: 0 });
  m.mats.push(mat);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  const root = new THREE.Group();
  root.add(mesh);
  inkScenery(root, { heavy: true });
  const items = Array.from({ length: n }, (_, i) => {
    const th = (i / n) * TAU + hash(i + 3) * 0.3;
    const out = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    const r = g.sealR * (0.92 + hash(i + 7) * 0.2);
    const hgt = g.hf * (0.42 + hash(i + 11) * 0.38) + 0.25;
    const rad = 0.16 + g.hf * 0.05 + hash(i + 13) * 0.08;
    // Leaning outward: the z axis (the lean of the column tip) points outward
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3 + hash(i + 17) * 0.2, -th + Math.PI / 2, 0, 'YXZ'));
    return { pos: g.foe.clone().addScaledVector(out, r), q, hgt, rad, lag: hash(i + 19) * 0.35 };
  });
  const st = { k: 0, burn: 0 };
  const M = new THREE.Matrix4();
  const S = new THREE.Vector3();
  const P = new THREE.Vector3();
  let acc = 0;
  const layer = sc.vfx.layer(root, (dt) => {
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const k = clamp01(st.k * 1.35 - it.lag);
      const s = st.k > 0.999 ? 1 : ease.outBack(k);
      S.set(it.rad, Math.max(1e-3, it.hgt * s), it.rad);
      P.copy(it.pos).setY(-it.hgt * 0.1 * (1 - s));
      mesh.setMatrixAt(i, M.compose(P, it.q, S));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mat.uniforms.uEmissiveAmt.value = Math.max(0, st.burn - 0.3) * 0.45;
    root.visible = st.k > 0.002;
    // Azure flame darting up at the roots
    if (st.burn <= 0.01) return;
    acc += dt * (lo ? 40 : 110) * st.burn;
    const cnt = Math.floor(acc);
    if (!cnt) return;
    acc -= cnt;
    for (let j = 0; j < cnt; j++) {
      const it = items[Math.floor(Math.random() * n)];
      sc.vfx.emit({ pos: it.pos.clone().setY(0.15), count: 1, color: [BLUE, BLUE_HI], speed: [1.2, 3], dir: UP, spread: 0.35, life: [0.3, 0.6], size: [0.14, 0.28], sizeEnd: 0.15, radius: it.rad, gravity: -2, drag: 1.2, intensity: 0.8 });
    }
  }, () => geo.dispose());
  return { st, kill: () => layer.kill() };
}

// ───────────────────────── Small beats ─────────────────────────

/** Embers on the ground and flame tongues licking out of the mane (the current flame hue), until wrap-up */
function startEmbers(c: UltCtx): void {
  const { sc, side } = c;
  const m = mem(c);
  const g = m.g!;
  const lo = low(c);
  let a1 = 0;
  let a2 = 0;
  const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
    const [col, hi, core] = hueSet(m.hue);
    a1 += dt * (lo ? 12 : 26);
    let n = Math.floor(a1);
    if (n) {
      a1 -= n;
      sc.vfx.emit({ pos: g.home.clone().setY(0.1), count: n, color: [col, hi], speed: [0.5, 1.4], dir: UP, spread: 0.35, life: [0.9, 1.5], size: [0.04, 0.09], radius: g.h * 1.3, gravity: -1.1, drag: 0.6, intensity: 0.9 });
    }
    a2 += dt * (lo ? 25 : 55) * (0.6 + m.hue * 0.3);
    n = Math.floor(a2);
    if (n) {
      a2 -= n;
      sc.vfx.emit({ pos: manePos(c), count: n, color: [col, hi, core], speed: [0.6, 1.6], dir: UP, spread: 0.7, life: [0.25, 0.5], size: [0.07, 0.16], sizeEnd: 0.1, radius: g.h * 0.2, gravity: -3, drag: 1.2, intensity: 0.85 });
    }
  });
  m.layers.push(layer);
  void side;
}

/** Flame hue climbs a step (or the surge when it is already azure flame): mane flames spread, the color changes, flame tongues burst, a shockwave, and the tint and sky color turn with it */
function heat(c: UltCtx, to: number, surge: boolean): void {
  const { sc, cine, side } = c;
  const m = mem(c);
  const g = m.g!;
  const A = act(c);
  const lo = low(c);
  const h = g.h;
  const [col, hi, core] = HUES[to];
  const fx = sc.gs.timeline('fx');
  fx.to(A, { hue: to, duration: 0.16, ease: 'power2.out', onUpdate: () => (m.hue = A.hue ?? to) }, 0);
  fx.to(A, { flare: 1, duration: 0.08, ease: 'power2.out' }, 0);
  fx.to(A, { flare: 0.45, duration: 0.35, ease: 'power1.inOut' }, 0.1);
  m.hue = to;
  recolorOld(c, to);
  if (m.aura) {
    const au = m.aura.st;
    fx.to(au, { a: 1, len: 1.7 + (surge ? 0.4 : 0), duration: 0.08 }, 0);
    fx.to(au, { a: 0.75, len: 1.1 + to * 0.12, duration: 0.4, ease: 'power1.out' }, 0.1);
  }
  creature(c)?.setFlash(hi, 0.14 + to * 0.04);
  const mane = manePos(c);
  const head = sc.head(side);
  sc.vfx.emit({ pos: mane, count: (lo ? 20 : 45) + to * 10, color: [col, hi, core], speed: [2 + to, 4.5 + to], life: [0.25, 0.5], size: [0.09, 0.2], sizeEnd: 0.1, radius: h * 0.22, gravity: -3, drag: 2.4, intensity: 0.85 });
  sc.vfx.emit({ pos: mane, count: lo ? 10 : 24, color: [col, hi], speed: [2.5, 5], dir: UP, spread: 0.5, life: [0.3, 0.6], size: [0.12, 0.24], sizeEnd: 0.1, radius: h * 0.18, gravity: -4, drag: 1.5, intensity: 0.85 });
  cine.shock(head, 0.35 + to * 0.2, 0.4, 0.3 + to * 0.1);
  sc.rig.addTrauma(0.14 + to * 0.08 + (surge ? 0.1 : 0));
  void cine.look({ tint: GRADE[to] }, 0.14);
  void cine.pulse({ radial: 0.55 }, { radial: 0 }, 0.35);
  if (m.sky) fx.to(m.sky.st, { cold: to === 2 ? 1 : 0.3 * to, duration: 0.4, ease: 'power1.out' }, 0);
  playOr(igniteUrl, () => {
    synth.noise({ type: 'lowpass', f0: 600 + to * 400, f1: 140, dur: 0.45, gain: 0.35 });
    synth.tone({ type: 'sine', f0: 80 + to * 40, f1: 45, dur: 0.4, gain: 0.35 });
  }, { gain: 0.8, rate: 0.92 + to * 0.1 + (surge ? 0.05 : 0) });
}

// ───────────────────────── Cinematic ─────────────────────────

/** The blazing sun sets → forepaws press the ground → eyes open → flame hue climbs → coronation → roar */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side } = c;
  const m = mem(c);
  const g = geometry(c);
  m.g = g;
  const h = g.h;
  const A = act(c);
  const lo = low(c);
  // Show the flame hue at the moment of casting from the very start
  m.h0 = readHue(c);
  m.hue = m.h0;
  A.hue = m.h0;
  recolorOld(c, m.h0);
  // Build all of this move's objects first (none have appeared yet), and compile the shaders before the announcement
  m.sky = makeSky(c);
  m.layers.push({ kill: () => m.sky?.kill(), get alive() { return true; } });
  m.ring = makeCorona(c, g);
  m.aura = makeAura(c);
  m.seal = makeSeal(c);
  m.offCleanup = sc.addCleanup(() => {
    m.sky?.restore();
    for (const x of m.mats) x.dispose();
  });
  sc.stage.prewarm();

  const tl = sc.gs.timeline('world');
  const head0 = sc.head(side);
  const push = { k: 0 };
  // ① The blazing sun sets: dark red dusk, a low angle looking up at the face and mane
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    synth.dropMusic();
    ultSfx.swell(0.5, 0.18);
    playOr(rumbleUrl, () => {
      synth.noise({ type: 'lowpass', f0: 180, f1: 90, dur: 1.6, gain: 0.35, attack: 0.3 });
      synth.tone({ type: 'sine', f0: 48, f1: 40, dur: 1.6, gain: 0.3, attack: 0.3 });
    }, { gain: 0.75 });
    void cine.look({ letterbox: 1, vignette: 0.6, desat: 0.1, tint: GRADE[m.h0], lift: 0x0c0200, bloom: 0.7, fov: 1 }, 0.4, ease.outQuad);
    cine.track(() => sc.head(side), ['vig', 'haze']);
    void cine.look({ haze: 0.5, hazeRadius: 0.45 }, 0.6);
    const aim = () => sc.head(side).addScaledVector(UP, -h * 0.05);
    const camA = cine.orbitPos(side, head0.clone().setY(0), 46, h * 1.45 + 0.4, 0).setY(h * 0.26);
    const camB = cine.orbitPos(side, head0.clone().setY(0), 26, h * 1.2 + 0.3, 0).setY(h * 0.42);
    const ls = aim();
    cine.cut(camA, ls);
    ride(c, (pos, look, dt) => {
      pos.lerpVectors(camA, camB, ease.outQuad(push.k));
      ls.lerp(aim(), 1 - Math.exp(-dt * 8));
      look.copy(ls);
    });
    startEmbers(c);
  }, [], 0);
  tl.to(push, { k: 1, duration: T.corona, ease: 'none' }, 0);
  tl.to(m.sky.st, { k: 1, duration: 0.7, ease: 'power1.inOut' }, 0);
  tl.to(m.sky.st, { cold: 0.3 * m.h0, duration: 0.7 }, 0);
  tl.to(A, { focus: 1, duration: 0.3, ease: 'power2.out' }, 0);
  tl.to(A, { crouch: 0.6, duration: 0.5, ease: 'power2.out' }, 0.08);
  tl.to(m.aura.st, { a: 0.6, len: 1 + m.h0 * 0.12, duration: 0.5 }, 0.15);

  // ② Forepaws press the ground: glowing ground fissures split open under the paws
  tl.call(() => {
    const [col] = HUES[m.h0];
    for (const p of ['pawFL', 'pawFR']) {
      const at = anchorPos(c, p, () => g.home.clone().addScaledVector(g.f, h * 0.2)).setY(0.05);
      void sc.vfx.decal(at, crackTex(p === 'pawFL' ? 2 : 5), col, h * 0.9, 2.4, undefined, 1.4);
      sc.vfx.smoke({ pos: at.clone().setY(0.1), count: lo ? 5 : 10, color: DUST, speed: [0.6, 1.8], life: [0.5, 0.9], size: [0.18, 0.34], sizeEnd: 1.2, radius: 0.15, drag: 2, gravity: -0.3 });
    }
    ultSfx.thump(0.4);
    sc.rig.addTrauma(0.12);
  }, [], T.crack);

  // ③ Eyes open: eye glints, the source crystal and flame ridge light up
  tl.call(() => {
    const eyes = sc.eyes(side);
    for (const e of eyes.length ? eyes : [sc.head(side)]) void sc.vfx.glint(e, HUES[m.h0][1], 0.2 + h * 0.05, 0.55, 2.6);
    ultSfx.shing(0.9);
  }, [], T.glint);
  tl.to(A, { glow: 0.6, duration: 0.4 }, T.glint);

  // ④ Flame hue climbs
  const steps = m.h0 === 0 ? T.steps2 : T.steps1;
  steps.forEach((t, i) => tl.call(() => heat(c, Math.min(2, m.h0 + i + 1), m.h0 === 2), [], t));

  // ⑤ Coronation (cut): a ground-level low-angle full-body shot, the corona rising from the ground behind it, turning
  const ring = m.ring;
  const lift = { k: 0 };
  tl.call(() => {
    void cine.look({ fov: 1, roll: 0.02, vignette: 0.5, haze: 0.25 }, 0);
    const look0 = g.home.clone().setY(h * 0.55).lerp(g.ringC, 0.25);
    const look1 = g.ringC.clone().lerp(sc.head(side), 0.45);
    const p0 = g.camSig.clone();
    const p1 = g.camSig.clone().lerp(sc.head(side), 0.1);
    // The camera is directly in front of the lion shooting back, so the belly of a long opponent (the whale) would poke in from the right edge of the frame; it is put back at the start of deliver
    cine.offstage(c.foe, true);
    cine.cut(p0, look0);
    cine.track(() => sc.head(side), ['vig']);
    ride(c, (pos, look) => {
      pos.lerpVectors(p0, p1, ease.outQuad(lift.k));
      look.lerpVectors(look0, look1, ease.inOutQuad(lift.k));
    });
    // The corona breaks through the ground: the ground behind it splits open and rubble leaps up
    const at = g.ringC.clone().setY(0.06);
    void sc.vfx.decal(at, crackTex(4), 0xff7a2a, g.ringR * 2.6, 1.6, undefined, 1.2);
    sc.vfx.smoke({ pos: at.clone().setY(0.2), count: lo ? 10 : 22, color: DUST, speed: [1.5, 3.5], dir: UP, spread: 0.8, life: [0.6, 1.1], size: [0.3, 0.6], sizeEnd: 1.4, radius: g.ringR * 0.8, drag: 1.6, gravity: -0.4 });
    void sc.vfx.debris(at, 0x4a3632, lo ? 6 : 12, 6, 1.3, 0.12 * h / 2.5, g.ringR);
    sc.rig.addTrauma(0.3);
    synth.noise({ type: 'lowpass', f0: 400, f1: 120, dur: 0.5, gain: 0.3 });
    synth.tone({ type: 'sawtooth', f0: 60, f1: 110, dur: 0.4, gain: 0.06, attack: 0.3 });
  }, [], T.corona);
  tl.to(lift, { k: 1, duration: T.roar - T.corona, ease: 'none' }, T.corona);
  tl.to(ring.st, { rise: 1, duration: T.lock - T.corona, ease: 'power3.out' }, T.corona);
  tl.to(ring.st, { rays: 1, duration: 0.42, ease: 'none' }, T.corona + 0.06);
  tl.to(A, { crouch: 0.15, duration: 0.35, ease: 'power1.inOut' }, T.corona);
  tl.to(A, { glow: 1, duration: 0.3 }, T.lock);
  // Corona lock: azure flame ignites on the ring, the golden crown flashes
  tl.call(() => {
    playOr(coronaUrl, () => {
      synth.tone({ type: 'triangle', f0: 196, dur: 1.6, gain: 0.12 });
      synth.tone({ type: 'sine', f0: 98, dur: 1.8, gain: 0.2 });
    }, { gain: 0.8 });
    sc.rig.addTrauma(0.25);
    void cine.pulse({ radial: 0.4 }, { radial: 0 }, 0.4);
    const top = g.ringC.clone().addScaledVector(UP, g.ringR * 1.16);
    void sc.vfx.glint(top, BLUE_HI, 0.8 + h * 0.2, 0.5, 3);
    void sc.vfx.glint(anchorPos(c, 'crownGem', () => sc.head(side).addScaledVector(UP, h * 0.1)), 0xffd0a0, 0.14 + h * 0.03, 0.3, 2.4);
    for (let i = 0; i < 3; i++) sc.vfx.emit({ pos: g.ringC, count: lo ? 12 : 26, color: [BLUE, BLUE_HI, 0xffe6a0], speed: [1, 3], life: [0.5, 1], size: [0.06, 0.13], radius: g.ringR * 1.1, gravity: 3, drag: 0.8, intensity: 0.8 });
  }, [], T.lock);
  tl.to(ring.st, { fire: 1, duration: 0.2, ease: 'power2.out' }, T.lock);

  // ⑥ Roar: pushes sharply to in front of the face along the same line of sight, mouth open, head thrown back, mane flames fully open, sound waves pushing forward
  tl.call(() => {
    playOr(roarUrl, () => {
      for (const [f0, d] of [[98, 0], [104, 7], [147, -9]] as const) synth.tone({ type: 'sawtooth', f0, f1: f0 * 0.55, dur: 0.9, gain: 0.14, attack: 0.04, detune: d });
      synth.noise({ type: 'bandpass', f0: 500, f1: 180, q: 1.2, dur: 0.9, gain: 0.45, attack: 0.05 });
    }, { gain: 0.85 });
  }, [], T.roar - 0.06);
  tl.call(() => {
    const hd = sc.head(side);
    const dir = g.camSig.clone().sub(hd).normalize();
    dir.y *= 0.35;
    dir.normalize();
    const p = hd.clone().addScaledVector(dir, h * 1.55);
    const lk = hd.clone().lerp(g.ringC, 0.2);
    void cine.shot(p, lk, 0.22, ease.outExpo);
    void cine.look({ fov: 1.1, roll: 0 }, 0.22, ease.outQuad);
  }, [], T.roar);
  // Head raised a little less (roar 0.85, with a bit of crouch to bring the head down), roaring with the face toward the camera, not showing only the chin
  tl.to(A, { roar: 0.85, duration: 0.14, ease: 'back.out(2)' }, T.roar);
  tl.to(A, { flare: 1, crouch: 0.35, duration: 0.12, ease: 'power2.out' }, T.roar);
  tl.to(ring.st, { blaze: 1, duration: 0.14, ease: 'power2.out' }, T.roar + 0.06);
  tl.to(m.aura.st, { a: 0.85, len: 1.45, duration: 0.12 }, T.roar + 0.06);
  tl.call(() => {
    const mouth = mouthPos(c);
    const out = mouth.clone().sub(sc.head(side)).setY(0).normalize().lerp(g.f, 0.5).normalize();
    const [, hi] = hueSet(m.hue);
    // The corona pushes out two shockwave rings (lying on the ring plane, behind the lion king)
    for (let i = 0; i < 2; i++) void c.wait(i * 0.09).then(() => sc.vfx.ring(g.ringC, BLUE, g.ringR * 1.2, g.ringR * (2 + i * 0.4), 0.4, g.ringN));
    void out;
    void cine.pulse({ radial: 0.8, lines: 0.85, linesColor: hi }, { radial: 0.15, lines: 0 }, 0.45);
    cine.track(() => sc.head(side), ['vig', 'radial', 'haze']);
    cine.shock(mouth, 1, 0.5, 0.8);
    sc.rig.addTrauma(0.7);
    if (!lo) sc.stage.chromatic(0.7);
    ultSfx.thump(0.6);
    // Dust on the ground blown away by the roar
    for (let i = 0; i < 10; i++) {
      const th = (i / 10) * TAU;
      const d = new THREE.Vector3(Math.cos(th), 0.15, Math.sin(th));
      sc.vfx.smoke({ pos: g.home.clone().addScaledVector(d, h * 0.45).setY(0.12), count: lo ? 2 : 4, color: DUST, speed: [3, 5.5], dir: d, spread: 0.25, life: [0.4, 0.8], size: [0.25, 0.5], sizeEnd: 1.3, drag: 2.2, gravity: -0.2 });
    }
  }, [], T.roar + 0.06);
  tl.set({}, {}, T.windup);
  await playTimeline(tl);
}

/** Sun-flame torrent: side-on follow shot → target's view */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const g = m.g ?? geometry(c);
  m.g = g;
  const h = g.h;
  const hf = g.hf;
  const A = act(c);
  const lo = low(c);
  cine.offstage(foe, false);
  const to = sc.center(foe).addScaledVector(UP, hf * 0.05);
  const beam = makeBeam(c, to);
  m.beam = beam;
  const ring = m.ring;
  const tl = sc.gs.timeline('world');
  // Mouth open level: the roar's open mouth plus crouching, the head pressed back to horizontal
  tl.to(A, { crouch: 0.9, duration: 0.12, ease: 'power2.out' }, 0);
  tl.to(beam.st, { k: 1, duration: T.deliver, ease: 'none' }, 0);
  if (ring) {
    tl.to(ring.st, { feed: 1, blaze: 0.6, duration: 0.3 }, 0);
    tl.to(ring.st, { fire: 0.55, duration: 0.6 }, 0.3);
  }
  // ① Side-on follow shot: the camera slides forward on the audience side alongside the leading edge of the flame stream
  tl.call(() => {
    playOr(torrentUrl, () => {
      sfx.whooshBig();
      synth.noise({ type: 'bandpass', f0: 300, f1: 2400, q: 1, dur: 0.6, gain: 0.4 });
    }, { gain: 0.75 });
    synth.noise({ type: 'lowpass', f0: 900, f1: 300, dur: 1.0, gain: 0.22, attack: 0.05 });
    void cine.look({ fov: 1.05, roll: 0, haze: 0, bloom: 0.45 }, 0.1);
    void cine.pulse({ radial: 0.3 }, { radial: 0 }, 0.3);
    const start = mouthPos(c);
    const L = Math.max(3.4, h * 1.6 + 1.1);
    const tgt = new THREE.Vector3();
    const lk = new THREE.Vector3();
    const place = () => {
      const H = start.clone().lerp(to, beam.st.k);
      tgt.copy(H).addScaledVector(g.f, -h * 0.9).addScaledVector(g.a, L).setY(Math.max(0.6, start.y * 0.9));
      lk.copy(H).addScaledVector(g.f, h * 0.2).setY(start.y * 0.75);
    };
    place();
    cine.cut(tgt, lk);
    ride(c, (pos, look, dt) => {
      place();
      const s = 1 - Math.exp(-dt * 14);
      pos.lerp(tgt, s);
      look.lerp(lk, s);
    });
    // The corona's fire draws in toward the lion king
    let acc = 0;
    const feed = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      if (!ring || ring.st.feed <= 0.01) return;
      acc += dt * (lo ? 40 : 90) * ring.st.feed;
      const n = Math.floor(acc);
      if (!n) return;
      acc -= n;
      sc.vfx.emit({ pos: ring.root.position, count: n, color: [BLUE, BLUE_HI], speed: [3, 5], inward: true, radius: g.ringR * 1.5, life: [0.25, 0.4], size: [0.08, 0.16], sizeEnd: 0.3, drag: 0.5, intensity: 0.8 });
    });
    m.layers.push(feed);
    // The ground splits open along the way and rocks leap up
    let next = 0.12;
    const trench = sc.vfx.layer(new THREE.Object3D(), () => {
      while (beam.st.k >= next && next < 0.95) {
        const p = start.clone().lerp(to, next).setY(0.05);
        void sc.vfx.decal(p, crackTex(Math.floor(next * 10)), BLUE, 1.4 + next * 1.2, 2.2, undefined, 1.2);
        sc.vfx.smoke({ pos: p.clone().setY(0.15), count: lo ? 3 : 7, color: DUST, speed: [1, 2.6], dir: UP, spread: 0.7, life: [0.4, 0.8], size: [0.2, 0.4], sizeEnd: 1.2, radius: 0.25, drag: 1.8, gravity: -0.3 });
        if (!lo && Math.round(next * 10) % 2 === 0) void sc.vfx.debris(p, 0x4a3632, 4, 4.5, 1.1, 0.09, 0.4);
        next += 0.14;
      }
      if (next >= 0.95) trench.kill();
    });
    m.layers.push(trench);
  }, [], 0);

  // ② Target's view (cut): behind the opponent, audience side, Ignisar and the corona in the distance, the flame stream sweeping across the frame
  tl.call(() => {
    const fov = 1.15;
    void cine.look({ fov, vignette: 0.55, radial: 0 }, 0);
    const foeC = sc.center(foe);
    const me = sc.head(side);
    const look0 = foeC.clone().lerp(me, 0.36).setY(Math.max(h, hf) * 0.42);
    // Framing size: take the larger of height and body length, so a long opponent (the whale) does not fill half the frame
    const fs = Math.max(hf, (sc.slots[foe].creature?.width ?? 0) * 0.8);
    const d = fitDist(c, fs * 1.4, fs * 1.6, fov) * 0.7 + 1.4;
    const p0 = cine.orbitPos(side, g.foe, 58, d, 0).setY(hf * 0.85 + 0.55);
    const p1 = p0.clone().lerp(look0, 0.12);
    cine.cut(p0, look0);
    cine.track(() => sc.center(foe), ['vig']);
    let tt = 0;
    ride(c, (pos, look, dt) => {
      tt += dt;
      pos.lerpVectors(p0, p1, ease.inOutQuad(Math.min(1, tt / (T.deliver - T.target + 0.35))));
      look.copy(look0);
    });
    ultSfx.swell(T.deliver - T.target, 0.16);
  }, [], T.target);
  tl.set({}, {}, T.deliver);
  await playTimeline(tl);
}

/** Impact: azure flame engulfs, the corona seal; pull back; the corona shrinks back into the golden crown */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe, side } = c;
  if (ev.hitIndex < ev.hits) return;
  const m = mem(c);
  const g = m.g!;
  const hf = g.hf;
  const lo = low(c);
  const pos = sc.center(foe);
  const home = g.foe.clone();
  const fx = sc.gs.timeline('fx');
  // ① Azure flame engulfs
  playOr(blastUrl, () => synth.noise({ type: 'lowpass', f0: 2600, f1: 120, dur: 0.6, gain: 0.45 }), { gain: 0.9 });
  sfx.impactBig();
  sc.stage.screenFlash(BLUE_HI, lo ? 0.12 : 0.18, 8);
  sc.slots[foe].creature?.setFlash(BLUE_HI, 0.55);
  // A ring of azure flame leaps up on the opponent's body
  sc.vfx.emit({ pos: home.clone().setY(hf * 0.3), count: lo ? 18 : 40, color: [0x1a3fb8, BLUE, BLUE_HI], speed: [1.5, 4], dir: UP, spread: 0.5, life: [0.35, 0.7], size: [0.25, 0.5], sizeEnd: 0.2, radius: hf * 0.5, gravity: -2.5, drag: 1.5, intensity: 0.5 });
  const camD = sc.stage.camera.position.distanceTo(pos);
  void sc.vfx.ring(home.clone().setY(0.1), BLUE_HI, 0.5, Math.min(g.sealR * 2.6, camD * 0.6), 0.6);
  void sc.vfx.decal(home.clone().setY(0.06), crackTex(3), BLUE, g.sealR * 3 + 1, 2.6, undefined, 1.6);
  sc.vfx.emit({ pos, count: lo ? 25 : 55, color: [BLUE, BLUE_HI], speed: [3, 8], life: [0.35, 0.7], size: [0.08, 0.18], sizeEnd: 0.1, radius: hf * 0.3, drag: 2, intensity: 0.7 });
  sc.vfx.emit({ pos: home.clone().setY(0.3), count: lo ? 25 : 55, color: [BLUE, BLUE_HI], speed: [3, 9], dir: UP, spread: 0.6, life: [0.5, 1.1], size: [0.12, 0.26], sizeEnd: 0.05, radius: hf * 0.4, gravity: -3, drag: 1.5, intensity: 0.75 });
  if (!lo) sc.stage.chromatic(0.5);
  void cine.pulse({ lift: 0x14307a, tint: 0xa8c8ff }, { lift: 0x000000, tint: GRADE[2] }, 0.6);
  cine.shock(pos, 1.3, 0.8, 1.2);
  cine.track(() => sc.center(foe), ['radial', 'vig']);
  void cine.pulse({ radial: 0.25 }, { radial: 0 }, 0.35);
  if (m.beam) {
    const b = m.beam.st;
    fx.to(b, { a: 1.15, duration: 0.06 }, 0);
    fx.to(b, { a: 0, duration: 0.45, ease: 'power2.in' }, 0.18);
  }
  // Corona seal: a ring of basalt columns bursts out of the ground, azure flame darting at the roots
  if (m.seal) {
    fx.to(m.seal.st, { k: 1, duration: 0.2, ease: 'none' }, 0.02);
    fx.to(m.seal.st, { burn: 1, duration: 0.1 }, 0.02);
    fx.to(m.seal.st, { burn: 0.25, duration: 0.8 }, 0.5);
    void sc.vfx.debris(home.clone().setY(0.2), 0x3a2c2a, lo ? 6 : 12, 7, 1.3, 0.12, g.sealR);
    sc.vfx.smoke({ pos: home.clone().setY(0.2), count: lo ? 10 : 24, color: DUST, speed: [2, 4.5], life: [0.5, 1], size: [0.3, 0.6], sizeEnd: 1.4, radius: g.sealR, drag: 2, gravity: -0.4 });
  }
  if (m.sky) fx.to(m.sky.st, { cold: 1, duration: 0.1 }, 0);

  // ② Pull back: retreating back and up from the target's view
  void c.wait(T.pull).then(() => {
    const r = sc.rig;
    const look = r.look.clone().add(new THREE.Vector3(0, hf * 0.2, 0));
    const p = look.clone().add(r.pos.clone().sub(r.look).multiplyScalar(1.25)).add(new THREE.Vector3(0, hf * 0.3, 0));
    void cine.shot(p, look, 0.55, ease.outCubic);
  });
  // ③ Coronation finish (cut): a three-quarter medium shot on the audience side, the corona shrinking into a beam of light that flies back to the golden crown, the camera slowly pushing in with it
  void c.wait(T.crownCut).then(() => {
    const h = g.h;
    const hd = sc.head(side);
    const p0 = cine.orbitPos(side, g.home, 38, fitDist(c, h * 1.9, h * 1.7, 1) * 0.85 + h * 0.3, 0).setY(h * 0.72);
    const p1 = p0.clone().lerp(hd, 0.12);
    const look = g.home.clone().setY(h * 0.62).lerp(hd, 0.35);
    void cine.look({ vignette: 0.5, radial: 0, fov: 1 }, 0);
    cine.cut(p0, look);
    cine.track(() => sc.head(side), ['vig']);
    let tt = 0;
    ride(c, (pos, lk, dt) => {
      tt += dt;
      pos.lerpVectors(p0, p1, ease.outQuad(Math.min(1, tt / 0.9)));
      lk.copy(look);
    });
  });
  void c.wait(T.crown).then(() => crownCorona(c));
  void c.wait(T.settle).then(() => settle(c, 0, 0.4));
  // The caster: slowly closes its mouth after the roar
  const A = act(c);
  const back = sc.gs.timeline('world');
  back.to(A, { roar: 0.25, crouch: 0.2, flare: 0.5, duration: 0.6, ease: 'power2.inOut' }, 0.4);
}

/** The corona shrinks back into the golden crown (the "Corona" status, three turns) */
function crownCorona(c: UltCtx): void {
  const { sc, side } = c;
  const m = mem(c);
  const ring = m.ring;
  if (!ring || m.crowned) return;
  m.crowned = true;
  const h = m.g?.h ?? 1.5;
  const tl = sc.gs.timeline('fx');
  tl.to(ring.st, { crown: 1, duration: 0.55, ease: 'none' }, 0);
  tl.to(ring.st, { blaze: 0, feed: 0, duration: 0.3 }, 0);
  tl.call(() => {
    const at = anchorPos(c, 'crownGem', () => sc.head(side).addScaledVector(UP, h * 0.1));
    void sc.vfx.glint(at, BLUE_HI, 0.5 + h * 0.12, 0.6, 3);
    sc.vfx.emit({ pos: anchorPos(c, 'crown', () => at), count: low(c) ? 10 : 22, color: [BLUE_HI, 0xffe6a0, BLUE_CORE], speed: [0.6, 1.8], life: [0.4, 0.8], size: [0.05, 0.1], radius: h * 0.08, gravity: 0.8, drag: 1.5, intensity: 0.85 });
    ultSfx.shing(1.1);
    synth.tone({ type: 'sine', f0: 880, f1: 1320, dur: 0.5, gain: 0.05 });
  }, [], 0.55);
}

/** Blocked: the flame stream hits the barrier and splashes outward around it, then the shared "almost shattered, finally holds" */
async function guarded(c: UltCtx): Promise<void> {
  const { sc, foe } = c;
  const m = mem(c);
  const hf = m.g?.hf ?? 1.5;
  const pos = sc.center(foe);
  const lo = low(c);
  const from = sc.center(c.side);
  const n = pos.clone().sub(from).setY(0).normalize();
  const hit = pos.clone().addScaledVector(n, -hf * 0.7);
  for (let i = 0; i < 8; i++) {
    const th = (i / 8) * TAU;
    const side = new THREE.Vector3().crossVectors(n, UP).normalize();
    const d = side.clone().multiplyScalar(Math.cos(th)).addScaledVector(UP, Math.sin(th)).addScaledVector(n, 0.3).normalize();
    sc.vfx.emit({ pos: hit, count: lo ? 6 : 14, color: [BLUE, BLUE_HI], speed: [4, 8], dir: d, spread: 0.25, life: [0.25, 0.5], size: [0.1, 0.22], sizeEnd: 0.1, drag: 2, intensity: 0.85 });
  }
  if (m.beam) sc.gs.timeline('fx').to(m.beam.st, { a: 0, duration: 0.4, ease: 'power2.in' }, 0.1);
  const A = act(c);
  sc.gs.timeline('world').to(A, { roar: 0.2, crouch: 0.2, flare: 0.4, duration: 0.45, ease: 'power2.inOut' }, 0.1);
  void c.wait(1.1).then(() => crownCorona(c));
  await ultGuarded(c);
}

/** After a miss or a block: the flame stream is removed, then wrap-up as usual */
function settleUlt(c: UltCtx): void {
  const m = mem(c);
  if (m.beam && m.beam.st.a > 0) c.sc.gs.timeline('fx').to(m.beam.st, { a: 0, duration: 0.3 }, 0);
  settle(c);
}

/** Afterglow: weights go to zero, the mane returns to its original color; the rock columns shrink back into the ground, the corona is taken back into the golden crown; sky color and lighting are restored */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  c.cine.track(null);
  crownCorona(c);
  const A = act(c);
  // The mane returns to the flame hue after the impact (azure flame when the ultimate opens the corona), not always back to crimson flame
  const hue1 = readHue(c, c.latest());
  const tl = sc.gs.timeline('world');
  tl.to(A, { roar: 0, crouch: 0, flare: 0, duration: 0.35, ease: 'power2.inOut' }, 0);
  tl.to(A, { hue: hue1, glow: 0, duration: 0.7, ease: 'power1.inOut', onUpdate: () => (m.hue = A.hue ?? hue1) }, 0.2);
  tl.to(A, { focus: 0, duration: 0.5, ease: 'power1.inOut' }, 0.6);
  if (m.aura) tl.to(m.aura.st, { a: 0, duration: 0.5 }, 0);
  if (m.seal) tl.to(m.seal.st, { k: 0, burn: 0, duration: 0.5, ease: 'power2.in' }, 0.1);
  if (m.beam) tl.to(m.beam.st, { a: 0, duration: 0.2 }, 0);
  if (m.sky) tl.to(m.sky.st, { k: 0, cold: 0, duration: 0.7, ease: 'power1.inOut' }, 0.1);
  tl.call(() => void c.cine.look({ tint: 0xffffff, haze: 0 }, 0.6), [], 0);
  tl.set({}, {}, 0.95);
  await playTimeline(tl);
  for (const l of m.layers) l.kill();
  m.layers = [];
  for (const x of [m.ring, m.aura, m.beam, m.seal]) x?.kill();
  m.sky?.restore();
  m.sky?.kill();
  restoreOld(c);
  for (const k of ['roar', 'crouch', 'flare', 'glow', 'focus']) if (k in A) A[k] = 0;
  if ('hue' in A) A.hue = hue1;
  m.offCleanup?.();
  // Wait for the effects layer to remove the meshes on the next frame before disposing the shared materials
  const mats = m.mats;
  m.mats = [];
  void sc.tw.wait(0.1, 'real').then(() => {
    for (const x of mats) (x as SpiritMaterial).dispose();
  });
  delete c.mem.ign;
}

export default defineSsr({
  windup,
  deliver,
  impact,
  guarded,
  settle: settleUlt,
  after,
  quietHit: true,
  // The opponent is trapped in the corona seal, so the impact does not knock it back
  pinFoe: true,
});
