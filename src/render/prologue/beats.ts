// Storyboard of the prologue animation: five segments; each segment sets up the world in enter, and tick works out the camera and picture from the in-segment time lt.
// Each segment follows just one picture: the beating heart, the river of light, the eight light pillars, red eyes, the opening eyes.
//
// night (0-20) the Night of the Shattered Heart
//   0-4.9     Low-angle wide shot from the hillside outside the city: a sleeping town (lights still on in the windows), a huge beating heart hanging above, a figure standing on the tip of a tall slender tower
//   4.9-8.2   Side view of the tower top: the masked figure leans forward and reaches out; at 6.2 the hand presses into the heart, and purple-black cracks spread from the palm
//   8.2-10.6  The heart screams: wide shot, the Void Blight pours into the city from the wound like a black waterfall, and the sky cracks with it
//   10.6-12.6 Looking up from the street: the black waterfall crashes onto the Star Gate plaza, black mist rolls down the street, and the lights in the windows go out one by one
//   12.6-15.6 Shattering: wide shot, the heart bursts, eight colored beams of light shoot toward the horizon, and a black hole is left in the sky
//   15.6-19.8 Ground level: crowds run past in front of the camera; the white-gold dragon spreads its wings and blocks the black waterfall with a golden light shield;
//             under the dragon's wing Elda raises her hand, and the pact sigil on the back of her hand lights up
// title (20-23) black screen, title
// lost (23-40) the lost world
//   23-28.6   Gliding low over the hills at dawn, a colorful river of light flows over the land, motes rise
//   28.6-33.6 By the river: the motes gather, and three small spirits leap out of the light one after another
//   33.6-40   Backlit side two-shot: the child and a small spirit touch foreheads, a golden pact circle opens; the child raises a hand and the sigil lights up on the back of it
// after (40-57) aftermath
//   40-42.2   A source crystal falls from the sky beneath the black hole (tracking close-up) and is caught by the fire sacred spirit on the hill
//   42.2-45.6 Three low-angle quick cuts: the sacred spirits catch the source crystals one after another, light up in their own colors, and the light pillars shoot to the sky
//   45.6-47.6 Rising wide view: the dark outskirts of the city, a ring of eight colored light pillars
//   47.6-53   At the edge of the city: purple light from a crack in the ground, black mist seeping out; the small spirit twitches, turns into its corrupted form, and its red eyes turn toward the camera
//   53-57     Under the Star Gate: the door flickers a few times and goes out; the dragon lies down, lowers its head and closes its eyes, and the world goes dark
// now (57-72) the present
//   57-61.8   Black screen with the "A Thousand Years Later" card, the starry sky fades in, a meteor shower streaks over the town
//   61.8-67.4 Pushing in on the Star Gate: the door flickers on and off; at 66 s it lights steadily, a pillar of light straight up into the night sky
//   67.4-72   The dark chamber beneath the gate: light falls from above onto the dragon's face; the dragon opens its eyes and turns to the camera; it ends in golden light

import * as THREE from 'three';
import { VILLAGE } from './valley.ts';
import { GATE_R, GATE_Y, heightAt, stretchTrail, tintCity, tintGate, type Person } from './sets.ts';
import { FIGURE, HEART, HEART_SIZE, OUT, PLATFORM, SIDE, WOUND } from './layout.ts';
import { shieldMaterial } from './shaders.ts';
import { MOOD, SACRED, SACRED_COLOR, SMALL, type PrologueScene as P } from './index.ts';
import { CUE, TOTAL } from './script.ts';
import { bump, easeIn, easeInOut, easeOut, faceTo, lerp, outBack, ramp, smooth, type CamKey, type V3 } from './util.ts';
import { LIGHT } from '../toon.ts';

export interface Beat {
  id: string;
  enter(p: P): void;
  tick(p: P, lt: number, dt: number): void;
  leave?(p: P): void;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const ARM_DOWN = V(0, -1, 0);
const linear = (x: number) => x;

/** Pulse built from several impact moments (each impact jumps to 1 at that instant, then decays at decay) */
function pulses(t: number, times: readonly number[], decay = 3): number {
  let s = 0;
  for (const ti of times) if (t >= ti) s += Math.exp(-(t - ti) * decay);
  return Math.min(1.5, s);
}

/** Arm i points at target (k 0 = hanging down, 1 = pointing at the target) */
function aimArm(f: Person, i: number, target: THREE.Vector3, k: number): void {
  const arm = f.arms[i];
  const parent = arm.parent!;
  parent.updateMatrixWorld(true);
  _v.copy(target);
  parent.worldToLocal(_v);
  _v.sub(arm.position).normalize();
  _q.setFromUnitVectors(ARM_DOWN, _v);
  _q2.setFromEuler(_e.set(0, 0, (i === 0 ? -1 : 1) * 0.12));
  arm.quaternion.copy(_q2).slerp(_q, k);
}

/** Sigil patch: placed at the at position, nudged toward the camera */
function sigilAt(p: P, s: THREE.Sprite, at: THREE.Vector3, size: number, opacity: number, rot: number): void {
  _v3.copy(p.rig.pos).sub(at).normalize().multiplyScalar(0.12);
  s.position.copy(at).add(_v3);
  s.scale.setScalar(Math.max(0.001, size));
  s.material.opacity = opacity;
  s.material.rotation = rot;
}

// ───────────────────────── 1. Night of the Shattered Heart ─────────────────────────

const NIGHT_CITY = 0x2c2842;
const DRAGON_S = 1.5;
const DRAGON_AT = V(-1.5, PLATFORM, 2.4);
const ELDA_AT = V(1.3, PLATFORM, 5.2);
const DOME = V(0, PLATFORM, 3.0);
const DOME_R = 5.2;
/** Where the torrent lands: behind the Star Gate plaza */
const SPLASH = V(-1.2, PLATFORM, -1.5);

interface NightMem {
  hbIdx: number;
  camA: CamKey[];
  camB: CamKey[];
  touched?: boolean;
  screamed?: boolean;
  flooded?: boolean;
  shattered?: boolean;
  grounded?: boolean;
  marked?: boolean;
  blacked?: boolean;
  shardDir: THREE.Vector3[];
  shield: THREE.Mesh;
  shieldMat: THREE.ShaderMaterial;
}

/** Position of fragment i at k seconds after the shattering: first bursts outward, then arcs toward the horizon */
function shardPos(dir: THREE.Vector3, k: number, out: THREE.Vector3): THREE.Vector3 {
  const s = 30 * (1 - Math.exp(-1.5 * Math.max(0, k)));
  return out.copy(HEART).addScaledVector(dir, s).add(_v3.set(0, -2.6 * k * k, 0));
}

const night: Beat = {
  id: 'night',
  enter(p) {
    p.mood(MOOD.night);
    p.bloom(0.7);
    tintCity(p.city, NIGHT_CITY);
    tintGate(p.gate, 0x3c3858);
    p.city.group.visible = true;
    p.city.lanternMat.opacity = 1;
    p.city.lanternMat.color.set(0xffb050).multiplyScalar(1.5);
    p.gate.group.visible = true;
    p.gate.portal.uniforms.uOpen.value = 0.4;
    p.gate.runes.color.set(0xffd070).multiplyScalar(0.9);
    p.gate.beamMat.opacity = 0;
    p.spire.visible = true;
    p.heart.group.visible = true;
    p.heart.group.position.copy(HEART);
    p.heart.mesh.visible = true;
    p.heart.mat.uniforms.uCrack.value = 0;
    p.heart.mat.uniforms.uAlpha.value = 1;
    _v.copy(WOUND).sub(HEART).divideScalar(HEART_SIZE);
    p.heart.mat.uniforms.uWound.value.set(_v.x, _v.y, _v.z, 0);
    const m = p.people.masked;
    m.g.visible = true;
    m.g.position.copy(FIGURE);
    m.g.rotation.y = faceTo(FIGURE, WOUND);
    p.wound.position.copy(WOUND);
    p.wound.scale.setScalar(0.001);
    // Torrent: spouts from the wound toward the camera side and falls into the Star Gate plaza beside the tower
    const t0 = p.torrents[0];
    const jet = WOUND.clone().addScaledVector(SIDE, 1.6).addScaledVector(OUT, 0.6).add(V(0, -0.8, 0));
    t0.path([WOUND.clone().addScaledVector(OUT, -0.4), jet, V(lerp(jet.x, SPLASH.x, 0.35), 17, lerp(jet.z, SPLASH.z, 0.35)), V(lerp(jet.x, SPLASH.x, 0.8), 6, lerp(jet.z, SPLASH.z, 0.8)), SPLASH.clone()], 0.7, 2.4);
    t0.mat.uniforms.uGrow.value = 0;
    // The second stream: hangs straight down from the bottom of the heart
    const t1 = p.torrents[1];
    t1.path([HEART.clone().add(V(0.4, -5.2, 0.6)), HEART.clone().add(V(0.8, -10, 1.2)), V(1.8, 9, -2), V(2.4, PLATFORM, -3.5)], 0.9, 2.0);
    t1.mat.uniforms.uGrow.value = 0;
    // Wide shot from the hillside outside the city
    // There are 12% black bars at top and bottom, so the visible field of view is only 76%: the look-at point must be lower than the heart for both the skyline and the heart to be in frame
    const ya = Math.max(2.5, heightAt(16, 50) + 1.8);
    const yb = Math.max(2.8, heightAt(14, 45) + 2.2);
    const camA: CamKey[] = [
      { t: 0, pos: [16, ya, 50], look: [-1, 17, -8], fov: 1.03 },
      { t: CUE.reach, pos: [14, yb, 45], look: [-2, 19, -7], fov: 0.95, ease: linear },
    ];
    // Straight side view of the tower top: a tiny black silhouette stands on the tower tip and reaches out to press into the glowing heart that fills half the frame
    const at = (side: number, out: number, up: number): V3 => [FIGURE.x + SIDE.x * side + OUT.x * out, FIGURE.y + up, FIGURE.z + SIDE.z * side + OUT.z * out];
    const camB: CamKey[] = [
      { t: 0, pos: at(12, 0.6, 0.9), look: at(0, -1.4, 1.5), fov: 1 },
      { t: CUE.touch - CUE.reach, pos: at(10, 0.4, 1.0), look: at(0, -1.2, 1.4), fov: 0.95, ease: easeOut },
      { t: CUE.scream - CUE.reach, pos: at(8.6, 0.3, 1.05), look: at(0, -1.1, 1.4), fov: 0.9, ease: linear },
    ];
    const shieldMat = shieldMaterial(0xffd070);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), shieldMat);
    shield.position.copy(DOME);
    shield.visible = false;
    p.root.add(shield);
    const shardDir: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const s = p.shards[i];
      s.core.scale.set(0.9, 1.6, 0.9);
      s.glow.scale.setScalar(5.5);
      // The eight directions scatter into a radial flower on screen, slightly upward
      const a = (i / 8) * Math.PI * 2 + 0.35;
      shardDir.push(V(Math.cos(a), Math.sin(a) * 0.72 + 0.3, Math.sin(a * 3) * 0.35 + 0.15).normalize());
    }
    const mem = p.mem as unknown as NightMem;
    mem.hbIdx = 0;
    mem.camA = camA;
    mem.camB = camB;
    mem.shield = shield;
    mem.shieldMat = shieldMat;
    mem.shardDir = shardDir;
  },
  leave(p) {
    const m = p.mem as unknown as NightMem;
    p.root.remove(m.shield);
    m.shield.geometry.dispose();
    m.shieldMat.dispose();
  },
  tick(p, lt) {
    const g = p.stage.grade;
    const m = p.mem as unknown as NightMem;
    const alive = lt < CUE.shatter;
    // ── Heart: pulse, halo, wound and cracks ──
    const hb = pulses(lt, CUE.heartbeats, 3.2);
    const dying = ramp(lt, CUE.scream, CUE.shatter);
    const spasm = dying * (0.5 + 0.5 * Math.sin(lt * 23) * Math.sin(lt * 7.3));
    const pulse = alive ? hb * (1 - dying * 0.6) + spasm * 0.8 : 0;
    p.heart.group.scale.setScalar(HEART_SIZE * (1 + 0.04 * pulse));
    p.heart.mat.uniforms.uPulse.value = pulse;
    _c.set(0xff5aa8).lerp(_c2.set(0x9a40ff), dying * 0.8);
    p.heart.mat.uniforms.uInner.value.copy(_c);
    p.heart.glowMat.color.copy(_c).multiplyScalar(0.9);
    p.heart.glowMat.opacity = alive ? 0.3 + 0.3 * pulse : 0;
    p.heart.haloMat.opacity = alive ? 0.2 + 0.35 * pulse : 0;
    p.heart.halo.rotation.z = lt * 0.2;
    p.heart.mat.uniforms.uCrack.value = ramp(lt, CUE.touch, CUE.shatter);
    p.heart.mat.uniforms.uWound.value.w = ramp(lt, CUE.touch, CUE.scream) * 0.45;
    p.skyMat.uniforms.uCrack.value = alive ? ramp(lt, CUE.scream - 0.4, CUE.shatter) * 0.9 : 1;
    _v.copy(HEART).sub(p.rig.pos).normalize();
    if (alive) p.skyGlow(_c.set(0xff7ac8).lerp(_c2.set(0x6a28d8), dying), 0.15 + 0.12 * pulse, _v);
    else p.skyGlow(0x3a1070, 0.18, _v);
    // Heartbeat: each beat ripples out a ring of light
    while (m.hbIdx < CUE.heartbeats.length && lt >= CUE.heartbeats[m.hbIdx]) {
      if (lt < CUE.reach) void p.vfx.ring(HEART, 0xff8ad0, 2.5, 10, 1.2, _v.copy(p.rig.pos).sub(HEART).normalize());
      p.rig.addTrauma(lt < CUE.reach ? 0.08 : 0.04);
      m.hbIdx++;
    }
    // The wound splits open
    const wo = ramp(lt, CUE.touch, CUE.touch + 1.6);
    p.wound.visible = wo > 0 && alive;
    p.wound.position.copy(WOUND);
    p.wound.lookAt(_v.copy(WOUND).addScaledVector(OUT, 1).addScaledVector(SIDE, 0.6));
    p.wound.scale.setScalar(0.3 + easeOut(wo) * 1.8 + dying * 1.2);
    p.woundMat.uniforms.uOpen.value = 0.3 + wo * 0.7;
    // Masked figure: leans forward, reaches out, presses in
    const masked = p.people.masked;
    const reach = smooth(ramp(lt, CUE.reach + 0.2, CUE.touch));
    masked.torso.rotation.x = 0.3 * reach;
    masked.head.rotation.x = 0.1 * reach;
    aimArm(masked, 0, _v2.copy(WOUND).addScaledVector(OUT, -0.25 * ramp(lt, CUE.touch, CUE.touch + 0.6)), reach);
    aimArm(masked, 1, _v2.copy(FIGURE).addScaledVector(OUT, 1).add(V(0, -1, 0)), 0.15);
    // The masked figure is a black silhouette, and only the mask is white
    p.silhouette(masked.av.c, 0.93, 0x07040c);
    // Lights in the city: they go out one by one after the Void Blight pours in
    const lights = 1 - ramp(lt, CUE.flood + 0.3, CUE.shatter - 0.2);
    p.city.lanternMat.opacity = lights;
    p.gate.portal.uniforms.uOpen.value = 0.4 * (1 - ramp(lt, CUE.flood, CUE.flood + 1.5)) + (lt > CUE.ground ? 0.12 : 0);
    // Torrent
    const t0 = p.torrents[0];
    const t1 = p.torrents[1];
    const pour = alive && lt >= CUE.scream;
    t0.mesh.visible = pour;
    t0.mat.uniforms.uGrow.value = easeOut(ramp(lt, CUE.scream, CUE.scream + 1.4));
    t1.mesh.visible = pour && lt > CUE.scream + 0.7;
    t1.mat.uniforms.uGrow.value = easeOut(ramp(lt, CUE.scream + 0.7, CUE.scream + 2.3));
    // Along its path the torrent churns up black smoke and purple shards of light
    if (pour && !(lt >= CUE.flood && lt < CUE.shatter)) {
      for (const tr of [t0, t1]) {
        if (!tr.mesh.visible || !tr.curve) continue;
        const grow = tr.mat.uniforms.uGrow.value as number;
        for (let i = 0; i < (p.low ? 1 : 3); i++) {
          tr.curve.getPointAt(Math.random() * grow, _v);
          p.vfx.smoke({ pos: _v, count: 1, color: [0x0a0412, 0x1e0830], speed: [0.5, 2], life: [1, 2], size: [1.2, 2.6], sizeEnd: 2.4, drag: 1.5, intensity: 1, radius: 0.8 });
        }
        tr.curve.getPointAt(Math.random() * grow, _v);
        p.vfx.emit({ pos: _v, count: 1, color: [0xb050ff, 0xff40a0], speed: [1, 3], life: [0.4, 0.9], size: [0.15, 0.35], intensity: 0.85, gravity: 3, radius: 0.8 });
      }
    }

    if (lt < CUE.reach) {
      // ── A: wide shot outside the city ──
      p.cam(lt, m.camA);
      g.desat = 0;
    } else if (lt < CUE.scream) {
      // ── B: tower top ──
      p.cam(lt - CUE.reach, m.camB);
      p.bloom(0.55);
      if (!m.touched && lt >= CUE.touch) {
        m.touched = true;
        p.stage.screenFlash(0x7a30d8, 0.22, 5);
        void p.vfx.flash(WOUND, 0xb070ff, 1.2, 0.3);
        p.rig.addTrauma(0.3);
      }
      if (lt >= CUE.touch) {
        masked.hand(0, _v2);
        p.vfx.emit({ pos: _v2, count: 2, color: [0xa040ff, 0x5a1880], speed: [0.4, 1.6], life: [0.4, 0.9], size: [0.06, 0.16], intensity: 0.8, gravity: 1.2 });
        p.vfx.smoke({ pos: _v2, count: 1, color: [0x12061c, 0x2a0a3a], speed: [0.3, 0.9], dir: OUT, spread: 0.8, life: [0.6, 1.2], size: [0.2, 0.5], sizeEnd: 2.5, intensity: 1 });
      }
    } else if (lt < CUE.flood) {
      // ── C: the heart screams, wide shot ──
      const k = lt - CUE.scream;
      p.cam(k, [
        { t: 0, pos: [24, 3.2, 30], look: [-2, 15.5, -6], fov: 1.2 },
        { t: CUE.flood - CUE.scream, pos: [22, 3.6, 28], look: [-2, 16.5, -6], fov: 1.12, ease: linear },
      ]);
      p.bloom(0.65);
      p.rig.roll = -0.06 * ramp(k, 0, 1.2);
      if (!m.screamed) {
        m.screamed = true;
        p.stage.screenFlash(0x5a18b0, 0.35, 3);
        p.stage.chromatic(1.2);
        p.rig.addTrauma(0.6);
      }
      p.stage.chromatic(0.25 + Math.sin(lt * 40) * 0.12);
      p.rig.addTrauma(0.01);
      p.vfx.emit({ pos: WOUND, count: 2, color: [0xb050ff, 0xff40a0], speed: [3, 8], dir: SIDE, spread: 0.9, life: [0.5, 1.2], size: [0.2, 0.5], intensity: 0.85, gravity: 5 });
      g.desat = 0.1 * ramp(k, 0, 2);
    } else if (lt < CUE.shatter) {
      // ── D: bird's-eye view, the Void Blight spreads from the plaza like ink and swallows the lights in the city ──
      const k = lt - CUE.flood;
      const dur = CUE.shatter - CUE.flood;
      p.rig.roll = 0;
      // Looking obliquely down (about 37 degrees), so the sides and spires of the towers can be read
      p.cam(k, [
        { t: 0, pos: [17, 36, 40], look: [0, 0, -4], fov: 0.72 },
        { t: dur, pos: [15, 32, 36], look: [0, 0, -4], fov: 0.7, ease: linear },
      ]);
      if (!m.flooded) {
        m.flooded = true;
        p.rig.addTrauma(0.3);
      }
      p.rig.addTrauma(0.01);
      const r = 2 + easeOut(ramp(k, 0, dur)) * 27;
      const gu = p.ground.mat.uniforms;
      gu.uStain.value.set(0, 0, -2, r);
      gu.uVeins.value = 1;
      gu.uLitR.value = 34;
      p.groundLight(0, 0, -2, 0.26, 0xff9a50);
      p.city.lanternMat.opacity = 1 - ramp(r, 16, 28);
      // Towers: those not yet swallowed reflect a warm glow of lamplight; the roof edges are rimmed with a bright edge by the purple light below, so the city's shape can be seen
      tintCity(p.city, _c.set(0xb8a4b0).lerp(_c2.set(0x6a5a86), ramp(r, 8, 26)));
      LIGHT.rimColor.value.set(1.1, 0.42, 1.5);
      LIGHT.ambient.value.set(0.3, 0.26, 0.4);
      // Black smoke rolls up at the edge of the black stain
      const n = p.low ? 2 : 5;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        _v.set(Math.cos(a) * r, 0.4, -2 + Math.sin(a) * r);
        p.vfx.smoke({ pos: _v, count: 1, color: [0x06020c, 0x1a0828], speed: [1, 3], dir: V(Math.cos(a), 0.6, Math.sin(a)), spread: 0.4, life: [0.8, 1.4], size: [1.4, 2.6], sizeEnd: 1.8, drag: 1.2, intensity: 1 });
      }
      _v.set(0, 1, -2);
      p.vfx.emit({ pos: _v, count: 2, color: [0xb050ff, 0xff40a0], speed: [4, 10], dir: UP, spread: 1.2, life: [0.5, 1.1], size: [0.2, 0.45], intensity: 0.85, gravity: 6 });
      g.desat = 0.1;
    } else if (lt < CUE.ground) {
      // ── E: shattering ──
      const k = lt - CUE.shatter;
      p.rig.roll = 0;
      p.cam(k, [
        { t: 0, pos: [3, 8, 64], look: [0, 21, -8], fov: 1.08 },
        { t: CUE.ground - CUE.shatter, pos: [2, 8.6, 58], look: [0, 21.5, -8], fov: 1.02, ease: linear },
      ]);
      p.bloom(0.6);
      if (!m.shattered) {
        m.shattered = true;
        p.heart.mesh.visible = false;
        p.people.masked.g.visible = false;
        // Restore the lighting changed by the bird's-eye camera back to the night look
        p.mood(MOOD.night);
        p.ground.mat.uniforms.uVeins.value = 0;
        p.stage.screenFlash(0xffd8f0, 0.6, 3.2);
        p.stage.chromatic(1.4);
        p.rig.addTrauma(0.8);
        void p.vfx.flash(HEART, 0xffc0e0, 16, 0.4);
        p.vfx.emit({ pos: HEART, count: p.low ? 90 : 220, color: [0xffc8e8, 0xff6ab0, 0xc070ff], speed: [8, 26], life: [0.8, 2.0], size: [0.3, 0.8], intensity: 0.85, gravity: 3, drag: 0.8, radius: 3 });
        for (const s of p.shards) {
          s.g.visible = true;
          s.pos.copy(HEART);
          s.g.position.copy(HEART);
        }
      }
      for (let i = 0; i < 8; i++) {
        const s = p.shards[i];
        const kk = k - i * CUE.shardGap;
        shardPos(m.shardDir[i], kk, s.pos);
        s.g.position.copy(s.pos);
        s.g.visible = kk > 0;
        s.core.rotation.y += 0.3;
        s.core.rotation.x += 0.2;
        s.glow.scale.setScalar(5 + Math.sin(kk * 30) * 0.5);
        shardPos(m.shardDir[i], Math.max(0, kk - 0.35), _v);
        if (kk > 0.02) stretchTrail(s.trail, _v, s.pos, p.rig.pos, 1.8);
        else s.trail.visible = false;
        s.trailMat.opacity = 0.9;
        if (kk > 0 && kk < 2.2) p.vfx.emit({ pos: s.pos, count: 1, color: s.color, speed: [0.2, 1.2], life: [0.5, 1.1], size: [0.3, 0.6], intensity: 0.8 });
      }
      // A black hole is left in the sky
      p.wound.visible = true;
      p.wound.position.copy(HEART);
      p.wound.lookAt(p.rig.pos);
      p.wound.scale.setScalar(4 + easeOut(ramp(k, 0, 1.2)) * 6);
      p.woundMat.uniforms.uOpen.value = 1;
      g.desat = 0.2;
      g.tint.setScalar(1 - 0.25 * bump(k, 0, 0.15, 1.2));
    } else if (lt < CUE.black) {
      // ── F: the dragon shields Elda ──
      const k = lt - CUE.ground;
      if (!m.grounded) {
        m.grounded = true;
        for (const s of p.shards) {
          s.g.visible = false;
          s.trail.visible = false;
        }
        p.wound.visible = false;
        // Sideways facing right (+x), toward Elda
        p.place('eldarin', DRAGON_AT.x, DRAGON_AT.y, DRAGON_AT.z, Math.PI / 2 - 0.25, DRAGON_S);
        const e = p.people.elda;
        e.g.visible = true;
        e.g.position.copy(ELDA_AT);
        e.g.rotation.y = 0.15;
        m.shield.visible = true;
        // The black waterfall slamming straight down from the sky onto the top of the light shield
        p.torrents[0].path([V(-2, 40, -4), V(-1.2, 26, -1), V(-0.2, 14, 1.8), V(0.2, DOME.y + DOME_R + 0.4, DOME.z - 0.3)], 1.3, 1.9);
        p.torrents[0].mat.uniforms.uGrow.value = 1;
        p.torrents[0].mesh.visible = true;
        p.torrents[1].mesh.visible = false;
        p.bloom(0.55);
        p.stage.screenFlash(0x000000, 0.6, 6);
        p.skyMat.uniforms.uCrack.value = 1;
        p.ground.mat.uniforms.uStain.value.set(0, 0, 3, 40);
      }
      p.cam(k, [
        { t: 0, pos: [0.8, 1.5, 15.5], look: [0, 3.7, 2.6], fov: 1.08 },
        { t: 1.4, pos: [0.9, 1.5, 14.5], look: [0.1, 3.6, 2.6], fov: 1.06, ease: linear },
        // Cut to a low angle at the right front: in the foreground Elda with her hand raised, behind her the dragon with its head up and wings spread, and above it the golden light shield
        { t: 1.4, pos: [4.4, 0.85, 11.2], look: [-0.7, 4.3, 2.4], fov: 1.22 },
        { t: CUE.black - CUE.ground, pos: [4.0, 0.85, 10.5], look: [-0.6, 4.3, 2.4], fov: 1.18, ease: linear },
      ]);
      // Dragon: wings spread to shield Elda, front half reared up, head thrown back glaring at the Void Blight crashing down; when Elda's pact sigil ignites, the sigil on its forehead lights too
      // On the low-angle shot: the head turns a little toward the camera (to its own right) so the face can be seen
      const A = p.cr('eldarin').act;
      A.focus = 1;
      A.spread = 1;
      A.raise = 0.45;
      A.rear = 0.2;
      A.turn = lt >= CUE.ground + 1.4 ? -0.6 : 0;
      A.sigil = ramp(lt, CUE.mark, CUE.mark + 0.4);
      A.roar = 0.55 * bump(lt, CUE.mark - 0.15, CUE.mark + 0.1, CUE.mark + 1.1);
      // Golden light shield: the Void Blight smashes onto the top of the shield and slides down its surface
      const mk = ramp(lt, CUE.mark, CUE.mark + 0.5);
      m.shieldMat.uniforms.uAmt.value = 0.45 + 0.1 * Math.sin(lt * 9) + mk * 0.25;
      m.shieldMat.uniforms.uTime.value = lt;
      const n = p.low ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = 1.0 + Math.random() * 0.5;
        _v.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
        _v2.copy(DOME).addScaledVector(_v, DOME_R + 0.2);
        p.vfx.smoke({ pos: _v2, count: 1, color: [0x0a0412, 0x2a0a3a], speed: [2, 4], dir: _v.clone().setY(-0.3).normalize(), spread: 0.4, life: [0.5, 1.0], size: [0.6, 1.2], sizeEnd: 1.8, gravity: 5, intensity: 1 });
      }
      _v.set(DOME.x, DOME.y + DOME_R + 0.2, DOME.z - 0.3);
      p.vfx.emit({ pos: _v, count: 2, color: [0xffd070, 0xb050ff], speed: [3, 7], dir: V(0, 0.4, 0), spread: 1.2, life: [0.3, 0.7], size: [0.15, 0.35], intensity: 0.85, gravity: 6 });
      // Elda: looks up at the sky and raises her left hand, the pact sigil on the back of her hand lights up
      const e = p.people.elda;
      const raise = easeOut(ramp(lt, CUE.mark - 0.9, CUE.mark));
      e.head.rotation.x = -0.45 - raise * 0.1;
      e.arms[1].rotation.set(-raise * 2.7, 0, 0.12 + raise * 0.25);
      e.arms[0].rotation.set(0.2, 0, -0.35);
      e.hand(1, _v);
      sigilAt(p, p.sigils.elda, _v, 0.05 + outBack(mk) * 0.5, mk * (0.85 + 0.15 * Math.sin(lt * 20)), lt * 1.5);
      if (!m.marked && lt >= CUE.mark) {
        m.marked = true;
        void p.vfx.glint(_v, 0xffe8a0, 0.7, 0.5, 3);
        void p.vfx.ring(_v, 0xffd070, 0.1, 1.4, 0.5, _v2.copy(p.rig.pos).sub(_v).normalize());
        p.stage.screenFlash(0xffe0a0, 0.12, 4);
      }
      if (mk > 0) p.vfx.emit({ pos: _v, count: 1, color: [0xffe8a0, 0xffc040], speed: [0.3, 1.2], life: [0.4, 0.9], size: [0.06, 0.14], intensity: 0.85, gravity: -1 });
      p.groundLight(DOME.x, PLATFORM, DOME.z, 0.12 + mk * 0.1, 0xffc060);
      g.desat = 0.12;
    } else {
      // ── Smash to black ──
      if (!m.blacked) {
        m.blacked = true;
        p.rig.addTrauma(0.5);
      }
      g.tint.setScalar(0);
    }
  },
};

// ───────────────────────── 2. Title ─────────────────────────

const title: Beat = {
  id: 'title',
  enter(p) {
    p.mood(MOOD.black);
    p.stage.grade.tint.setScalar(0);
    p.heart.group.visible = false;
    p.city.group.visible = false;
    p.gate.group.visible = false;
    p.spire.visible = false;
    p.rig.pos.set(0, 5, 20);
    p.rig.look.set(0, 5, 0);
  },
  tick(p) {
    p.stage.grade.tint.setScalar(0);
  },
};

// ───────────────────────── 3. The lost world ─────────────────────────

/** The sun: low in front (-z), backlit */
const SUN = V(0.18, 0.1, -1).normalize();
const BIRTH_POS = [V(-7.3, 0, -33.2), V(-5.9, 0, -34.1), V(-8.8, 0, -34.6)];
const BIRTH_CAM = V(-7.0, 0, -28.6);
const CHILD = V(4.2, 0, -30);
/** How far the small spirit (`cloudfluff`) starts from the child */
const FLUFF_FROM = 2.4;
const FLUFF_S = 0.5;
/** Where on the child's forehead `cloudfluff`'s eye midpoint lines up when they touch foreheads (the new model's face is in front of the cloud mass, so align by the eye anchors, not the root node) */
const FLUFF_KISS = V(0.1, -0.07, -0.02);

const lost: Beat = {
  id: 'lost',
  enter(p) {
    p.mood(MOOD.day);
    p.bloom(0.5);
    p.heart.group.visible = false;
    p.city.group.visible = false;
    p.gate.group.visible = false;
    p.spire.visible = false;
    p.ground.mat.uniforms.uRivers.value = 1;
    p.ground.mat.uniforms.uFog.value.set(55, 170);
    p.skyGlow(0xffb860, 0.85, SUN);
    p.valley.group.visible = true;
    // Light comes from the sun in front: the side facing the camera falls in shadow, with a gold rim along the outline
    LIGHT.dir.value.set(SUN.x, 0.45, SUN.z).normalize();
    for (const bp of BIRTH_POS) bp.y = heightAt(bp.x, bp.z);
    BIRTH_CAM.y = heightAt(BIRTH_CAM.x, BIRTH_CAM.z);
    CHILD.y = heightAt(CHILD.x, CHILD.z);
  },
  leave(p) {
    p.stage.setFovScale(1);
    LIGHT.dir.value.set(0.45, 0.85, 0.35).normalize();
  },
  tick(p, lt) {
    const g = p.stage.grade;
    const t = lt + 23;
    // Darken everything a little in daytime, so the colors are not washed out into pastels
    const fade = ramp(lt, 0, 1.6) * 0.86;
    g.tint.setScalar(fade);
    const m = p.mem as { born?: boolean[]; touched?: boolean; marked?: boolean; met?: boolean; path?: CamKey[]; fluffOff?: THREE.Vector3 };
    // The windmill keeps turning, and the village sends up cooking smoke
    p.valley.blades.rotation.z = t * 0.9;
    if (Math.random() < (p.low ? 0.2 : 0.4)) {
      const ch = p.valley.chimneys[Math.floor(Math.random() * p.valley.chimneys.length)];
      p.vfx.smoke({ pos: ch, count: 1, color: [0xf4ece4, 0xdcd2d0], speed: [0.4, 0.8], dir: V(0.3, 1, 0.1), spread: 0.2, life: [2.5, 4], size: [0.4, 0.7], sizeEnd: 2.4, intensity: 0.45 });
    }
    if (t < CUE.river) {
      // ── A: rising out of the flowers to see the whole valley: the glowing river, the woods, the village on the hill, the sun coming up behind the village ──
      if (!m.path) {
        const h0 = heightAt(-11.5, 5);
        const h1 = heightAt(-8, -3);
        const hv = heightAt(VILLAGE.x, VILLAGE.z);
        m.path = [
          { t: 0, pos: [-11.5, h0 + 0.9, 5], look: [-6, h0 + 2.4, -12], fov: 1.02 },
          { t: CUE.river - CUE.dawn, pos: [-6, h1 + 9.5, -4], look: [VILLAGE.x - 10, hv + 2.5, VILLAGE.z + 4], fov: 1.0, ease: easeInOut },
        ];
      }
      p.cam(lt, m.path);
      // Motes floating up from the river
      const n = p.low ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const x = p.rig.pos.x + (Math.random() - 0.3) * 30;
        const z = p.rig.pos.z - 6 - Math.random() * 34;
        _v.set(x, heightAt(x, z) + 0.2, z);
        p.vfx.emit({ pos: _v, count: 1, color: [0xfff0c0, 0xbfe8ff, 0xffb0e0], speed: [0.3, 0.9], dir: UP, spread: 0.4, life: [2, 3.5], size: [0.12, 0.3], intensity: 0.8, gravity: -0.4 });
      }
      // A flock of birds flies across the sky from right to left
      const bk = ramp(t, CUE.dawn, CUE.river + 0.4);
      _v.set(lerp(30, -26, bk), lerp(15, 19, bk), lerp(-40, -26, bk));
      const heading = Math.atan2(-56, 14);
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      for (const b of p.valley.birds) {
        b.g.position.set(_v.x + fz * b.slot.x - fx * b.slot.z, _v.y + b.slot.y, _v.z - fx * b.slot.x - fz * b.slot.z);
        b.g.rotation.set(0, heading, 0);
        const a = Math.sin(t * 9 + b.phase) * 0.7;
        b.wings[0].rotation.z = a;
        b.wings[1].rotation.z = -a;
      }
      // Small spirits drifting by in the distance: a `candledove` crosses the valley, and a `cloudfluff` floats on the river
      const f1 = p.cr('far1');
      const fk = ramp(t, CUE.dawn, CUE.river);
      if (!f1.root.visible) {
        p.place('far1', 0, 0, -20, Math.PI / 2, 1.5);
        p.place('far2', -3, 0, -15, 0.4, 1.3);
      }
      f1.root.position.set(lerp(-9, 6, fk), heightAt(0, -20) + 4.5 + Math.sin(t * 2) * 0.3, -20);
      const f2 = p.cr('far2');
      f2.root.position.y = heightAt(-3, -15) + 1.4 + Math.sin(t * 1.6) * 0.25;
    } else if (t < CUE.meet) {
      // ── B: by the river, three small spirits born from the light ──
      const k = ramp(t, CUE.river, CUE.meet);
      // The river up close would blur into a sheet of white if too bright, so tone it down a little
      p.ground.mat.uniforms.uRivers.value = 0.45;
      p.cr('far1').root.visible = false;
      p.cr('far2').root.visible = false;
      p.valley.birdGroup.visible = false;
      p.rig.pos.set(BIRTH_CAM.x + lerp(-1.0, 0.8, k), BIRTH_CAM.y + 0.95, BIRTH_CAM.z + lerp(0.3, -0.5, k));
      p.rig.look.set(lerp(-7.6, -7.1, k), BIRTH_POS[0].y + 0.75, -34);
      p.zoom(0.95);
      m.born ??= [];
      // Light by the river: motes keep floating up from the ground
      for (let i = 0; i < 3; i++) {
        const bp = BIRTH_POS[i];
        p.vfx.emit({ pos: _v.set(bp.x, bp.y + 0.1, bp.z), count: 1, color: [0xfff0c0, 0xbfe8ff], speed: [0.2, 0.6], dir: UP, spread: 0.6, life: [1, 2], size: [0.05, 0.12], intensity: 0.8, gravity: -0.4, radius: 0.7 });
      }
      for (let i = 0; i < 3; i++) {
        const bt = CUE.births[i];
        const bp = BIRTH_POS[i];
        const gather = ramp(t, bt - 1.1, bt);
        if (gather > 0 && t < bt) {
          p.vfx.emit({ pos: _v.set(bp.x, bp.y + 0.5, bp.z), count: p.low ? 2 : 4, color: [0xfff0c0, 0xbfe8ff, 0xa0ffc0], speed: [2, 4], life: [0.3, 0.6], size: [0.05, 0.13], radius: 1.2, inward: true, intensity: 0.85 });
        }
        if (t >= bt) {
          const c = p.cr(SMALL[i]);
          if (!m.born[i]) {
            m.born[i] = true;
            p.place(SMALL[i], bp.x, bp.y, bp.z, faceTo(bp, p.rig.pos) + (i - 1) * 0.35);
            _v.set(bp.x, bp.y + 0.5, bp.z);
            void p.vfx.flash(_v, 0xfff0d0, 1.2, 0.3);
            void p.vfx.ring(_v2.set(bp.x, bp.y + 0.05, bp.z), 0xbfe8ff, 0.2, 1.8, 0.6);
            p.vfx.emit({ pos: _v, count: 16, color: [0xfff0c0, 0xbfe8ff], speed: [1, 3], life: [0.4, 0.9], size: [0.06, 0.16], intensity: 0.8, gravity: 2 });
          }
          const pop = ramp(t, bt, bt + 0.4);
          c.root.scale.setScalar(Math.max(0.01, outBack(pop)));
          c.root.position.y = bp.y + Math.sin(Math.PI * ramp(t, bt, bt + 0.55)) * 0.45;
        }
      }
    } else {
      // ── C: backlit side two-shot, the child and a small spirit touch foreheads ──
      const ch = p.people.child;
      const sp = p.cr('cloudfluff');
      if (!m.met) {
        m.met = true;
        p.ground.mat.uniforms.uRivers.value = 0.5;
        for (const id of SMALL) p.cr(id).root.visible = false;
        ch.g.visible = true;
        ch.g.position.copy(CHILD);
        // Both turn a little toward the camera (the stage's "open to the audience"), so the faces can be seen
        ch.g.rotation.y = Math.PI / 2 - 0.45;
        p.place('cloudfluff', CHILD.x + FLUFF_FROM, CHILD.y + 0.4, CHILD.z, -Math.PI / 2 + 0.45, FLUFF_S);
        // Offset from the root node to the midpoint of the two eyes (fall back to the head if there is no eye anchor)
        sp.root.updateMatrixWorld(true);
        const eyes = sp.eyes.length ? sp.eyes : [sp.head];
        const mid = eyes.reduce((a, e) => a.add(e.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).divideScalar(eyes.length);
        m.fluffOff = mid.sub(sp.root.position);
      }
      const off = m.fluffOff!;
      const approach = smooth(ramp(t, CUE.meet + 0.2, CUE.forehead));
      const bow = approach * (1 - ramp(t, CUE.mark2 - 0.6, CUE.mark2));
      ch.head.rotation.x = 0.2 * bow;
      ch.torso.rotation.x = 0.12 * bow;
      ch.forehead(_v);
      // `cloudfluff` floats over and presses its forehead against the child's
      sp.root.position.set(lerp(CHILD.x + FLUFF_FROM, _v.x + FLUFF_KISS.x - off.x, approach), lerp(CHILD.y + 0.4, _v.y + FLUFF_KISS.y - off.y, approach), lerp(CHILD.z, _v.z + FLUFF_KISS.z - off.z, approach));
      if (t >= CUE.forehead && !m.touched) {
        m.touched = true;
        _v2.copy(_v).add(V(0.12, 0.02, 0));
        void p.vfx.glint(_v2, 0xffe8a0, 0.4, 0.5, 3);
        p.stage.screenFlash(0xfff0d0, 0.06, 4);
      }
      // Pact circle: where the foreheads touch, a ring of golden circle opens, then folds into the back of the child's hand
      const open = ramp(t, CUE.forehead, CUE.forehead + 0.5);
      const shut = ramp(t, CUE.mark2 - 0.5, CUE.mark2);
      _v2.copy(_v).add(V(0.14, 0.05, 0));
      sigilAt(p, p.sigils.big, _v2, outBack(open) * 0.85 * (1 - shut * 0.9), open * (1 - shut) * 0.8, t * 0.8);
      // The child raises the right hand on the camera side, the sigil lights up on the back of the hand; a sigil also lights on `cloudfluff`'s forehead
      const raise = easeOut(ramp(t, CUE.mark2 - 0.7, CUE.mark2 + 0.1));
      ch.arms[0].rotation.set(-raise * 2.7, 0, -0.12 - raise * 0.25);
      ch.head.rotation.x -= raise * 0.4;
      ch.hand(0, _v);
      const mk = ramp(t, CUE.mark2, CUE.mark2 + 0.6);
      sigilAt(p, p.sigils.child, _v, 0.05 + outBack(mk) * 0.24, mk * 0.92, t * 1.2);
      sp.head.getWorldPosition(_v2);
      _v2.y += 0.16;
      const sm = ramp(t, CUE.mark2 + 0.15, CUE.mark2 + 0.75);
      sigilAt(p, p.sigils.spirit, _v2, 0.05 + outBack(sm) * 0.24, sm * 0.9, -t);
      if (t >= CUE.mark2 && !m.marked) {
        m.marked = true;
        void p.vfx.glint(_v, 0xffe8a0, 0.4, 0.5, 3);
        p.stage.screenFlash(0xfff0d0, 0.05, 4);
      }
      if (mk > 0) p.vfx.emit({ pos: _v, count: 1, color: [0xffe8a0, 0xffc040], speed: [0.2, 0.8], life: [0.4, 0.9], size: [0.05, 0.12], intensity: 0.85, gravity: -1 });
      // Camera: a slightly low side two-shot (the sun in the background), slowly pushing in after the sigil lights up and looking up at the raised hand
      const push = smooth(ramp(t, CUE.mark2 - 0.3, CUE.mark2 + 1.8));
      const midX = CHILD.x + 0.4;
      p.rig.pos.set(lerp(midX, midX - 0.25, push), CHILD.y + lerp(0.5, 0.5, push), CHILD.z + lerp(5.4, 4.3, push));
      p.rig.look.set(lerp(midX, midX - 0.2, push), CHILD.y + lerp(1.2, 1.25, push), CHILD.z);
      p.zoom(lerp(0.95, 0.9, push));
      g.vignette = 0.5;
      // Fade out at the end, into the darkness of the aftermath
      const out = ramp(t, 39.4, 40);
      g.tint.setScalar(1 - out);
    }
  },
};

// ───────────────────────── 4. Aftermath ─────────────────────────

/** The hills where the sacred spirits stand: a ring outside the city */
const RING_R = 30;
const ringPos = (i: number): THREE.Vector3 => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8 + 0.3;
  const x = Math.cos(a) * RING_R;
  const z = Math.sin(a) * RING_R;
  return V(x, heightAt(x, z), z);
};
/** The source crystals fall out of the black hole in the sky (where the heart used to be) */
const SKY_FROM = V(HEART.x, 44, HEART.z);
const SACRED_S = 2.2;
/** Light pillar brightness: stacked light-colored (wind, light) pillars would turn into a sheet of white, so scale down by brightness (index.ts and this file import each other, so it is computed only when used) */
const pillarAmt = (i: number): number => {
  const c = _c.set(SACRED_COLOR[i]);
  const lum = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
  return 0.85 * Math.min(1, 0.55 / lum);
};
const CORRUPT_AT = V(0.4, 0, 13.5);
const CORRUPT_CAM = V(0.7, 1.05, 18.6);
const CORRUPT_S = 0.8;

interface AfterMem {
  caught: boolean[];
  swapped?: boolean;
  cursed?: boolean;
  gateCut?: boolean;
  spots: THREE.Vector3[];
}

/** Position of source crystal i (k: 0 start, 1 caught) */
function fallPos(i: number, k: number, target: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const e = easeIn(k);
  return out.set(lerp(SKY_FROM.x, target.x, k * 0.6 + e * 0.4), lerp(SKY_FROM.y, target.y, e), lerp(SKY_FROM.z, target.z, k * 0.6 + e * 0.4));
}

const after: Beat = {
  id: 'after',
  enter(p) {
    p.mood(MOOD.dusk);
    p.bloom(0.6);
    tintCity(p.city, 0x241e36);
    tintGate(p.gate, 0x36324e);
    p.heart.group.visible = false;
    p.city.group.visible = true;
    p.city.lanternMat.opacity = 0;
    p.gate.group.visible = true;
    p.gate.portal.uniforms.uOpen.value = 0.2;
    p.gate.runes.color.set(0xffd070).multiplyScalar(0.5);
    p.gate.beamMat.opacity = 0;
    p.spire.visible = false;
    p.skyMat.uniforms.uCrack.value = 0;
    _v.copy(HEART).normalize();
    p.skyGlow(0x3a1060, 0.3, _v);
    p.wound.visible = true;
    p.wound.position.copy(HEART).setY(44);
    p.wound.scale.setScalar(16);
    p.woundMat.uniforms.uOpen.value = 1;
    const spots: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const pos = ringPos(i);
      spots.push(pos);
      p.place(SACRED[i], pos.x, pos.y, pos.z, faceTo(pos, V(0, 0, 0)), SACRED_S);
      const s = p.shards[i];
      s.g.visible = false;
      s.core.scale.set(0.45, 0.8, 0.45);
      s.glow.scale.setScalar(3);
      const pl = p.pillars[i];
      pl.mesh.position.copy(pos);
      pl.mat.uniforms.uAmt.value = 0;
    }
    (p.mem as unknown as AfterMem).spots = spots;
    (p.mem as unknown as AfterMem).caught = [];
    p.stage.grade.tint.setScalar(1);
  },
  tick(p, lt) {
    const t = lt + 40;
    const g = p.stage.grade;
    const m = p.mem as unknown as AfterMem;
    p.wound.lookAt(p.rig.pos);
    // ── Eight source crystals fall, each caught by a sacred spirit ──
    const sacredOn = t < CUE.blight;
    // In the rising wide view all eight sacred spirits are tiny: turn the outline off, which halves the draw calls (this shot used to drop frames)
    const wide = t >= CUE.catches + 4 * CUE.catchGap - 0.1;
    for (let i = 0; i < 8; i++) {
      const c = p.cr(SACRED[i]);
      const s = p.shards[i];
      const pl = p.pillars[i];
      for (const om of c.outlines) om.visible = !wide;
      if (!sacredOn) {
        c.root.visible = false;
        s.g.visible = false;
        s.trail.visible = false;
        pl.mesh.visible = false;
        continue;
      }
      const at = CUE.catches + i * CUE.catchGap;
      const from = i === 0 ? CUE.fall : at - 1.4;
      const k = ramp(t, from, at);
      // Where it is caught: in front of the sacred spirit's chest
      const target = _v2.copy(m.spots[i]).add(V(0, 1.6 * SACRED_S * 0.55, 0)).addScaledVector(_v3.copy(m.spots[i]).setY(0).normalize(), -0.9);
      if (k > 0 && k < 1) {
        fallPos(i, Math.max(0, k - 0.03), target, _v);
        fallPos(i, k, target, s.pos);
        s.g.visible = true;
        s.g.position.copy(s.pos);
        _v.sub(s.pos).multiplyScalar(i === 0 ? 5 : 3).add(s.pos);
        stretchTrail(s.trail, _v, s.pos, p.rig.pos, i === 0 ? 0.7 : 1.1);
        s.trailMat.opacity = 0.9;
        s.core.rotation.y += 0.12;
      } else if (k >= 1) {
        if (!m.caught[i]) {
          m.caught[i] = true;
          void p.vfx.flash(target, SACRED_COLOR[i], 1.8, 0.3);
          void p.vfx.ring(_v.copy(m.spots[i]).setY(m.spots[i].y + 0.1), SACRED_COLOR[i], 0.5, 6, 0.7);
          p.vfx.emit({ pos: target, count: 30, color: SACRED_COLOR[i], speed: [1, 5], life: [0.4, 1.1], size: [0.15, 0.4], intensity: 0.85, gravity: 1 });
          p.rig.addTrauma(0.2);
        }
        s.trail.visible = false;
        s.g.visible = true;
        s.g.position.copy(target);
        s.glow.scale.setScalar(3 + Math.sin(t * 6 + i) * 0.4);
        s.core.rotation.y += 0.05;
        pl.mesh.visible = true;
        pl.mat.uniforms.uAmt.value = pillarAmt(i) * smooth(ramp(t, at, at + 0.5)) * (1 - ramp(t, CUE.blight - 0.5, CUE.blight));
      } else {
        s.g.visible = false;
        s.trail.visible = false;
      }
      // Forelimbs raised before the catch, lowered a little after it
      c.attackPose = smooth(ramp(t, at - 0.6, at)) * (1 - 0.5 * smooth(ramp(t, at + 0.4, at + 1.4)));
      // Sacred spirit: normally a dark silhouette, at the instant of the catch it lights up from inside in its own color
      const lit = k >= 1 ? 0.35 + 0.65 * Math.exp(-(t - at) * 1.4) : 0;
      _c.set(0x0a0814).lerp(_c2.set(SACRED_COLOR[i]), lit * 0.8);
      p.silhouette(c, 0.9 - lit * 0.35, _c);
    }
    if (t < CUE.catches + 0.5) {
      // ── A: a source crystal falls, tracking shot, watching it get caught ──
      const s = p.shards[0];
      const tg = m.spots[0];
      _v.copy(tg).setY(0).normalize();
      const side = V(-_v.z, 0, _v.x);
      if (t < CUE.fall + 1.4) {
        // A1: behind the sacred spirit, from a low point outside the city, looking up at the black hole in the sky as fragments drop out of the hole one by one
        p.rig.pos.set(tg.x + _v.x * 6.5 + side.x * 2.2, tg.y + 0.8, tg.z + _v.z * 6.5 + side.z * 2.2);
        p.rig.look.copy(s.pos);
        p.zoom(0.8);
      } else {
        // A2: cut to the lion's oblique front at a low angle: it throws its head back and raises its forepaw, and a fragment streaks into frame from above and lands in the paw
        const kk = smooth(ramp(t, CUE.fall + 1.4, CUE.catches));
        p.rig.pos.set(tg.x - _v.x * 9 + side.x * 3.6, tg.y + 0.6, tg.z - _v.z * 9 + side.z * 3.6);
        p.rig.look.set(tg.x, lerp(tg.y + 4.2, tg.y + 3.0, kk), tg.z);
        p.zoom(0.95);
      }
      p.bloom(0.55);
      g.desat = 0.1;
    } else if (t < CUE.catches + 4 * CUE.catchGap - 0.1) {
      // ── B: three low-angle quick cuts ──
      const i = Math.min(3, Math.max(1, Math.floor((t - CUE.catches + 0.35) / CUE.catchGap)));
      const tg = m.spots[i];
      _v.copy(tg).setY(0).normalize();
      const side = V(-_v.z, 0, _v.x);
      const k = ramp(t, CUE.catches + i * CUE.catchGap - 0.35, CUE.catches + i * CUE.catchGap + 0.3);
      const sgn = i % 2 ? 1 : -1;
      p.rig.pos.set(tg.x - _v.x * (10.5 - k * 0.8) + side.x * 3.4 * sgn, tg.y + 0.5 + k * 0.2, tg.z - _v.z * (10.5 - k * 0.8) + side.z * 3.4 * sgn);
      p.rig.look.set(tg.x, tg.y + 3.2, tg.z);
      p.zoom(0.95);
    } else {
      // ── Rising wide view: a ring of eight colored light pillars ──
      const k = ramp(t, CUE.catches + 4 * CUE.catchGap - 0.1, CUE.blight);
      p.rig.pos.set(lerp(-10, -4, k), lerp(16, 34, smooth(k)), lerp(60, 70, smooth(k)));
      p.rig.look.set(0, lerp(4, 0, k), -4);
      p.zoom(1);
      p.bloom(0.55);
      g.desat = 0.05;
    }
    if (t >= CUE.blight && t < CUE.gateOff - 0.6) {
      // ── C: the Void Blight seeps out, the spirit goes mad ──
      const k = t - CUE.blight;
      const cute = p.cr('cloudfluff');
      const cor = p.cr('corrupt');
      if (!m.cursed) {
        m.cursed = true;
        p.place('cloudfluff', CORRUPT_AT.x, 0.45, CORRUPT_AT.z, faceTo(CORRUPT_AT, CORRUPT_CAM) + 0.9, CORRUPT_S);
        p.skyMat.uniforms.uCrack.value = 0.5;
      }
      p.ground.mat.uniforms.uCracks.value = ramp(k, 0, 2.2);
      p.ground.mat.uniforms.uBlight.value = ramp(k, 0.5, 3);
      p.groundLight(CORRUPT_AT.x, 0, CORRUPT_AT.z + 1, 0.22, 0x8a30ff);
      const n = p.low ? 2 : 4;
      for (let i = 0; i < n; i++) {
        _v.set(CORRUPT_AT.x + (Math.random() - 0.5) * 12, 0.1, CORRUPT_AT.z + (Math.random() - 0.5) * 9);
        p.vfx.smoke({ pos: _v, count: 1, color: [0x0a0412, 0x2a0a3a], speed: [0.2, 0.8], dir: UP, spread: 1.2, life: [1.5, 3], size: [0.8, 1.8], sizeEnd: 3, gravity: -0.2, intensity: 1 });
      }
      // Black mist coils around it
      if (k > 1.2 && t < CUE.redEye) p.vfx.smoke({ pos: _v.set(CORRUPT_AT.x, 0.2, CORRUPT_AT.z), count: 1, color: [0x12061c, 0x3a1050], speed: [0.3, 0.8], dir: UP, spread: 0.6, life: [0.8, 1.4], size: [0.4, 0.9], sizeEnd: 2, intensity: 1, radius: 0.6 });
      if (t < CUE.redEye) {
        const tw = ramp(t, CUE.redEye - 1.2, CUE.redEye);
        cute.root.position.x = CORRUPT_AT.x + (Math.random() - 0.5) * 0.14 * tw;
        cute.root.rotation.y = faceTo(CORRUPT_AT, CORRUPT_CAM) + 0.9 + Math.sin(t * 40) * 0.2 * tw;
        p.silhouette(cute, 0.55 * tw, 0x2a0a3a);
      } else {
        if (!m.swapped) {
          m.swapped = true;
          cute.root.visible = false;
          p.place('corrupt', CORRUPT_AT.x, 0.45, CORRUPT_AT.z, faceTo(CORRUPT_AT, CORRUPT_CAM) + 0.9, CORRUPT_S);
          void p.vfx.flash(_v.set(CORRUPT_AT.x, 0.9, CORRUPT_AT.z), 0xa040ff, 2.4, 0.3);
          p.vfx.smoke({ pos: _v, count: 24, color: [0x0a0412, 0x3a1050], speed: [1, 3], life: [0.6, 1.4], size: [0.5, 1.2], sizeEnd: 2.5, intensity: 1 });
          p.stage.screenFlash(0x6a20c0, 0.25, 5);
          p.stage.chromatic(0.8);
          p.rig.addTrauma(0.3);
        }
        const turn = smooth(ramp(t, CUE.redEye + 0.15, CUE.redEye + 0.8));
        cor.root.rotation.y = lerp(faceTo(CORRUPT_AT, CORRUPT_CAM) + 0.9, faceTo(CORRUPT_AT, CORRUPT_CAM), turn);
      }
      const push = smooth(ramp(k, 0, 5.4));
      p.rig.pos.set(CORRUPT_CAM.x, CORRUPT_CAM.y - push * 0.2, lerp(CORRUPT_CAM.z, CORRUPT_CAM.z - 2.6, push));
      // Watch the face (the beat where the eyes turn red must be in frame); after it swaps to the corrupted one, follow its head
      (m.swapped ? cor : cute).head.getWorldPosition(_v2);
      p.rig.look.set(CORRUPT_AT.x, lerp(0.95, _v2.y, 0.8), CORRUPT_AT.z);
      p.zoom(lerp(1, 0.8, push));
      p.bloom(0.55);
      g.desat = 0.25;
      g.grain = 0.3;
    } else if (t >= CUE.gateOff - 0.6) {
      // ── D: the Star Gate goes out, the dragon lies down and falls asleep ──
      const k = t - (CUE.gateOff - 0.6);
      const d = p.cr('eldarin');
      if (!m.gateCut) {
        m.gateCut = true;
        p.cr('cloudfluff').root.visible = false;
        p.cr('corrupt').root.visible = false;
        p.ground.mat.uniforms.uCracks.value = 0.3;
        p.ground.mat.uniforms.uBlight.value = 0.3;
        // Lying sideways in front of the gate, head to the right, turned slightly toward the camera
        p.place('eldarin', -0.6, PLATFORM, 2.6, GATE_SLEEP_YAW, 1.9);
      }
      p.cam(k, [
        { t: 0, pos: [0.6, 0.95, 17.5], look: [0.2, 3.4, 1.5], fov: 1.0 },
        { t: 57 - (CUE.gateOff - 0.6), pos: [0.8, 0.8, 15.2], look: [0.3, 2.7, 1.8], fov: 0.95, ease: linear },
      ]);
      g.desat = 0.3;
      g.grain = 0.2;
      // The door flickers a few times, then goes out
      const off = t >= CUE.gateOff;
      const flick = off ? 0 : 0.35 * (0.5 + 0.5 * Math.sin(t * 37) * Math.sin(t * 13));
      const dying = off ? Math.max(0, 0.3 - (t - CUE.gateOff) * 0.6) : flick;
      p.gate.portal.uniforms.uOpen.value = dying;
      p.gate.runes.color.set(0xffd070).multiplyScalar((0.6 * dying) / 0.3);
      p.groundLight(0, PLATFORM, 1.6, (0.3 * dying) / 0.3, 0x8fd8ff);
      // Dragon: lies down, neck curled to its right, head resting beside the front claws, wings folded, eyes closed, the sigil on its forehead going dark
      const lie = smooth(ramp(t, CUE.sleep - 0.8, CUE.sleep + 0.6));
      const sl = smooth(ramp(t, CUE.sleep, CUE.sleep + 1.3));
      d.act.focus = 1;
      d.act.sleep = lie;
      d.act.shut = sl;
      d.setGlowMul(1 - sl * 0.85);
      // The world goes dark
      const dark = ramp(t, 55.6, 56.9);
      p.mood(MOOD.dusk, MOOD.black, dark);
      g.tint.setScalar(1 - dark);
    }
  },
  leave(p) {
    p.stage.setFovScale(1);
  },
};

// ───────────────────────── 5. The present ─────────────────────────

const METEOR_SEED = [0.13, 0.71, 0.42, 0.88, 0.27, 0.59, 0.95, 0.06, 0.34, 0.77, 0.51, 0.19, 0.83, 0.46, 0.64, 0.02];
const CAM_METEOR: CamKey[] = [
  { t: 0, pos: [-5, 1.6, 26], look: [-1, 16, -20], fov: 1.05 },
  { t: 5, pos: [-4, 1.9, 24], look: [-1, 17, -20], fov: 1.0, ease: linear },
];
const CAM_GATE_ON: CamKey[] = [
  { t: 0, pos: [0.5, 1.4, 24], look: [0, 6.5, 0], fov: 1 },
  { t: 4.2, pos: [0.3, 1.7, 15.5], look: [0, 6.2, 0], fov: 1, ease: smooth },
  { t: 5.6, pos: [0.25, 1.8, 14.6], look: [0, 6.4, 0], fov: 1, ease: linear },
];
const DEN = V(0, -18, 0);
/** The dragon asleep in the dark chamber: facing right (+x), turned a little toward the camera; in its sleeping pose the head curls to its right side, so the face points right at the camera */
const SLEEP_YAW = Math.PI / 2 - 0.4;
/** The dragon asleep in front of the gate: almost facing the camera, its head curled to the left of the frame and resting beside the front claws, with the body and tail at the right rear, so the curled outline can be seen */
const GATE_SLEEP_YAW = 0.35;

const now: Beat = {
  id: 'now',
  enter(p) {
    p.mood(MOOD.black);
    p.stage.grade.tint.setScalar(0);
    p.bloom(0.6);
    tintCity(p.city, 0x3a3c5a);
    tintGate(p.gate, 0x4a4868);
    p.heart.group.visible = false;
    p.city.group.visible = true;
    p.city.lanternMat.opacity = 0;
    p.gate.group.visible = true;
    p.gate.portal.uniforms.uOpen.value = 0;
    p.gate.runes.color.setScalar(0);
    p.gate.beamMat.opacity = 0;
    p.spire.visible = false;
    p.wound.visible = false;
    p.ground.mat.uniforms.uCracks.value = 0.1;
    p.ground.mat.uniforms.uBlight.value = 0;
    for (let i = 0; i < 8; i++) {
      const s = p.shards[i];
      s.core.scale.set(0.32, 0.6, 0.32);
      s.glow.scale.setScalar(2.8);
      s.coreMat.color.set(0xdff4ff).multiplyScalar(1.6);
      s.glowMat.color.set(0xbfe8ff).multiplyScalar(1.1);
      s.trailMat.color.set(0xd8f0ff).multiplyScalar(1.2);
    }
  },
  tick(p, lt) {
    const t = lt + 57;
    const g = p.stage.grade;
    const m = p.mem as { landed: boolean[]; den?: boolean; opened?: boolean; on?: boolean; glint?: boolean };
    m.landed ??= [];
    if (t < CUE.gateOn - 4.2) {
      // ── A: the starry sky fades in, a meteor shower ──
      const fade = ramp(t, 58.0, 59.6);
      p.mood(MOOD.black, MOOD.late, fade);
      g.tint.setScalar(fade);
      p.cam(lt - 1, CAM_METEOR);
      p.city.lanternMat.opacity = ramp(t, 59, 61) * 0.8;
      p.city.lanternMat.color.set(0xffb060).multiplyScalar(1.3 + Math.sin(t * 5) * 0.1);
      for (let i = 0; i < CUE.meteors.length; i++) {
        const at = CUE.meteors[i];
        const s = p.shards[i % 8];
        const seed = METEOR_SEED[i];
        const seed2 = METEOR_SEED[(i * 7 + 3) % 16];
        // Meteors: streak across the sky from the upper right to the lower left, falling beyond the mountains behind the city
        const k = ramp(t, at - 0.9, at);
        if (t < at - 0.9 || t > at) continue;
        const x0 = 10 + seed * 50;
        const y0 = 26 + seed2 * 20;
        const z0 = -40 - seed2 * 20;
        s.g.visible = true;
        s.pos.set(x0 - k * 44, y0 - k * 24, z0);
        s.g.position.copy(s.pos);
        _v.set(x0 - Math.max(0, k - 0.22) * 44, y0 - Math.max(0, k - 0.22) * 24, z0);
        stretchTrail(s.trail, _v, s.pos, p.rig.pos, 0.75);
        s.trailMat.opacity = 0.9 * (1 - ramp(k, 0.8, 1));
        if (k >= 0.98) {
          s.g.visible = false;
          s.trail.visible = false;
        }
      }
    } else if (t < CUE.under) {
      // ── B: pushing in on the Star Gate, flickering, lighting up ──
      const k = t - (CUE.gateOn - 4.2);
      for (const s of p.shards) {
        s.g.visible = false;
        s.trail.visible = false;
      }
      p.mood(MOOD.late);
      p.cam(k, CAM_GATE_ON);
      p.city.lanternMat.opacity = 0.8;
      let open = 0;
      let flash = false;
      for (const f of CUE.flickers) {
        const d = t - f;
        if (d >= 0 && d < 0.14) {
          open = Math.max(open, 0.6 * (1 - d / 0.14));
          flash = flash || d < 0.03;
        }
      }
      // Dark night picture: only the gate ring and the vortex are bright
      p.bloom(0.45);
      g.vignette = 0.62;
      let ignite = 1;
      if (t >= CUE.gateOn) {
        if (!m.on) {
          m.on = true;
          p.rig.addTrauma(0.3);
        }
        // The gate ring ignites from the bottom, golden flame heads burn up both sides and join into a full ring; the vortex slowly brightens along with it
        ignite = smooth(ramp(t, CUE.gateOn, CUE.gateOn + 0.75));
        open = 0.62 * smooth(ramp(t, CUE.gateOn + 0.2, CUE.gateOn + 1.2));
        if (ignite < 1) {
          const a = ignite * Math.PI;
          for (const sx of [-1, 1]) {
            _v.set(sx * Math.sin(a) * GATE_R, GATE_Y - Math.cos(a) * GATE_R, 0.45);
            p.vfx.emit({ pos: _v, count: p.low ? 2 : 4, color: [0xffd070, 0xffb040, 0xfff0c0], speed: [1, 4], life: [0.3, 0.8], size: [0.08, 0.2], intensity: 0.85, gravity: 3 });
          }
        } else if (Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2;
          _v.set(Math.cos(a) * GATE_R, GATE_Y + Math.sin(a) * GATE_R, 0.45);
          p.vfx.emit({ pos: _v, count: 1, color: [0xffd070, 0x8fd8ff], speed: [0.2, 0.8], life: [0.8, 1.6], size: [0.06, 0.14], intensity: 0.8, gravity: -0.5 });
        }
        g.tint.setScalar(1);
      } else {
        if (flash) {
          p.stage.screenFlash(0x8fd8ff, 0.08, 8);
          p.rig.addTrauma(0.08);
        }
        g.tint.setScalar(1);
      }
      p.gate.portal.uniforms.uOpen.value = open;
      p.gate.portal.uniforms.uIgnite.value = ignite;
      p.gate.portal.uniforms.uRim.value = t >= CUE.gateOn ? ignite : 0;
      p.gate.runes.color.set(0xffd070).multiplyScalar(Math.max(open * 1.4, t >= CUE.gateOn ? ignite * 1.2 : 0));
      p.groundLight(0, PLATFORM, 2, open * 0.45, 0x8fd8ff);
    } else {
      // ── C: the dark chamber beneath the gate, the dragon opens its eyes ──
      const k = t - CUE.under;
      const d = p.cr('eldarin');
      if (!m.den) {
        m.den = true;
        p.city.group.visible = false;
        p.gate.group.visible = false;
        p.chamber.visible = true;
        p.chamber.position.set(0, -14, 0);
        p.sky.visible = false;
        p.ground.mesh.visible = false;
        p.place('eldarin', DEN.x, DEN.y, DEN.z, SLEEP_YAW, 1.6);
        p.stage.screenFlash(0x000000, 0.7, 6);
        p.bloom(0.5);
      }
      d.head.getWorldPosition(_v);
      // The camera is at the oblique front of the dragon's face (a three-quarter profile), a little above the eyes, slowly pushing in; the face direction is taken from the face center to the mouth
      const mouth = d.anchor('mouth');
      if (mouth) mouth.getWorldPosition(_v2).sub(_v).setY(0).normalize();
      else _v2.set(0, 0, 1);
      _v3.copy(_v2).applyAxisAngle(_up, 0.5);
      const dist = 5.4 - k * 0.22;
      p.rig.pos.set(_v.x + _v3.x * dist, _v.y + 0.55, _v.z + _v3.z * dist);
      p.rig.look.set(_v.x, _v.y + 0.1, _v.z);
      p.zoom(0.85);
      // Light falling from above, slowly brightening with the light of the gate; the chamber stays dark, with only the outline rimmed in warm light
      const light = smooth(ramp(k, 0.3, 1.8));
      const end = ramp(t, CUE.end, CUE.end + 0.25);
      const dim = 1 - end * 0.7;
      LIGHT.ambient.value.set((0.04 + light * 0.15) * dim, (0.036 + light * 0.13) * dim, (0.07 + light * 0.14) * dim);
      LIGHT.rimColor.value.set(1.2, 0.78, 0.4).multiplyScalar(0.35 + light * 0.8 + end * 0.6);
      // Dragon: asleep lying down, after opening its eyes it lifts its head slightly and turns toward the camera; the sigil on its forehead slowly lights up with the light of the gate
      const eye = outBack(ramp(t, CUE.eye, CUE.eye + 0.5));
      const lift = smooth(ramp(t, CUE.eye - 0.4, CUE.eye + 0.8));
      const turn = smooth(ramp(t, CUE.eye + 0.4, CUE.eye + 1.5));
      d.act.focus = 1;
      d.act.sleep = 1 - 0.18 * lift;
      d.act.shut = 1 - Math.min(1, Math.max(0, eye));
      d.act.turn = -0.35 * turn;
      d.act.sigil = (0.1 + light * 0.3 + eye * 0.3) * dim;
      d.setGlowMul((0.3 + light * 0.4 + eye * 0.3) * dim);
      if (t >= CUE.eye && !m.opened) {
        m.opened = true;
        p.stage.screenFlash(0xffe0a0, 0.05, 5);
      }
      if (k > 0.5 && t < CUE.end) p.vfx.emit({ pos: _v2.set(_v.x, _v.y + 1.2, _v.z), count: 1, color: [0xfff0c0, 0xffd070], speed: [0.05, 0.3], life: [1.5, 3], size: [0.03, 0.08], intensity: 0.7, gravity: 0.15, radius: 1.5 });
      // Ending: the golden eye nearest the camera flashes once, then the whole picture sinks into darkness
      if (t >= CUE.end && !m.glint) {
        m.glint = true;
        let best = Infinity;
        for (const e of d.eyes) {
          e.getWorldPosition(_v3);
          const dd = _v3.distanceTo(p.rig.pos);
          if (dd < best) {
            best = dd;
            _v2.copy(_v3);
          }
        }
        _v2.lerp(p.rig.pos, 0.04);
        void p.vfx.glint(_v2, 0xffe6a0, 0.32, 0.55, 4);
      }
      g.tint.setScalar(1 - smooth(ramp(t, CUE.end + 0.2, TOTAL - 0.05)));
    }
  },
  leave(p) {
    p.sky.visible = true;
    p.ground.mesh.visible = true;
    p.cr('eldarin').setGlowMul(1);
  },
};

export const BEAT_DEFS: Beat[] = [night, title, lost, after, now];
