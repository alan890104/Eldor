// Sets for the prologue animation: the ground, the town's towers, the Star Gate, the tall tower, silhouette characters, the Heart of the World, source crystal fragments, the dark chamber beneath the gate.
// The towers, Star Gate and tall tower use sceneMaterial (the same MeshToon shading as the spirits), with the outline handed to the post-process outline by inkScenery;
// the ground, sky, door, heart and light pillars are their own shaders and get no lines. The characters (buildPerson and the three *Extra) are still the old Kit and are handled separately.

import * as THREE from 'three';
import { glowMaterial } from '../toon.ts';
import { sceneMaterial, type SpiritMaterial } from '../spiritToon.ts';
import { inkScenery } from '../ink.ts';
import { glowTex, ringTex, runeCircleTex } from '../textures.ts';
import { rayTex, streakTex } from '../fxtex.ts';
import { groundMaterial, heartMaterial, portalMaterial, glowMat, torrentMaterial, pillarMaterial } from './shaders.ts';
import { Avatar, PROLOGUE_LOOKS, type Outfit } from '../field/avatar.ts';
import { fbm2, lerp, rng, smooth, clamp01 } from './util.ts';
import { taperedTube } from '../vfx.ts';
import { MASK_S } from './layout.ts';

export const GROUND_R = 90;

/** Terrain height: flat around the town, hills farther out, and a mountain ridge on the outermost ring */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const flat = smooth(clamp01((r - 15) / 16));
  const hills = (fbm2(x * 0.035 + 3.1, z * 0.035 + 7.7) - 0.45) * 9 * flat;
  const ridge = smooth(clamp01((r - 50) / 30)) * (6 + fbm2(x * 0.06, z * 0.06) * 14);
  return hills + ridge;
}

export interface Ground {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
}

export function buildGround(low: boolean): Ground {
  const seg = low ? 90 : 150;
  const geo = new THREE.CircleGeometry(GROUND_R, seg, 0, Math.PI * 2);
  // CircleGeometry has only an outer ring, so it is replaced here with a regular grid for there to be any undulation
  const grid = new THREE.PlaneGeometry(GROUND_R * 2, GROUND_R * 2, seg, seg);
  grid.rotateX(-Math.PI / 2);
  geo.dispose();
  const pos = grid.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(0x63b25e);
  const b = new THREE.Color(0xc2a854);
  const c = new THREE.Color(0x3f7f52);
  const stone = new THREE.Color(0xb8b0a4);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = fbm2(x * 0.08 + 11, z * 0.08 + 5);
    tmp.copy(a).lerp(b, smooth(clamp01((n - 0.35) * 2.2)));
    tmp.lerp(c, smooth(clamp01(-h * 0.25)));
    const r = Math.hypot(x, z);
    tmp.lerp(stone, smooth(clamp01((15 - r) / 6)));
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
  }
  grid.setAttribute('color', new THREE.BufferAttribute(col, 3));
  grid.computeVertexNormals();
  const mat = groundMaterial(low);
  const mesh = new THREE.Mesh(grid, mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

// ───────────────────────── Town ─────────────────────────

export interface Tower {
  g: THREE.Group;
  /** Direction of collapse (radians) and degree of tilt 0 to 1 */
  dir: number;
  h: number;
  lantern: THREE.Mesh;
}

export interface City {
  group: THREE.Group;
  towers: Tower[];
  mats: SpiritMaterial[];
  /** Lantern material (lit after the rebuild) */
  lanternMat: THREE.MeshBasicMaterial;
}

export function buildCity(low: boolean): City {
  const group = new THREE.Group();
  const r = rng(41);
  const wall = sceneMaterial(0xe6dccb, { rim: 0.35 });
  const wall2 = sceneMaterial(0xd4c4b0, { rim: 0.35 });
  const roof = sceneMaterial(0x4a5aa8, { rim: 0.4 });
  const roof2 = sceneMaterial(0x8a4a6a, { rim: 0.4 });
  const lanternMat = glowMaterial(0xffc060, 0);
  lanternMat.transparent = true;
  lanternMat.opacity = 0;
  const towers: Tower[] = [];
  const n = low ? 18 : 30;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + r() * 0.2;
    const rad = 8.5 + r() * 13;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    // Leave a walkway on the camera's front side (+z)
    if (z > 4 && Math.abs(x) < 4.5) continue;
    const h = 2.6 + r() * 5;
    const rr = 0.7 + r() * 0.7;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.9, rr, h, 10), r() < 0.5 ? wall : wall2);
    body.position.y = h / 2;
    g.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(rr * 1.15, rr * 1.6, 10), r() < 0.6 ? roof : roof2);
    cap.position.y = h + rr * 0.8;
    g.add(cap);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lanternMat);
    lantern.position.set(rr * 0.8, h * (0.45 + r() * 0.3), 0);
    lantern.rotation.y = r() * 6.28;
    g.add(lantern);
    group.add(g);
    towers.push({ g, dir: ang + Math.PI + (r() - 0.5) * 1.2, h, lantern });
  }
  // Lanterns are self-lit materials, which inkScenery skips automatically
  inkScenery(group);
  return { group, towers, mats: [wall, wall2, roof, roof2], lanternMat };
}

const CITY_BASE = [0xe6dccb, 0xd4c4b0, 0x4a5aa8, 0x8a4a6a];
/** Tint of the town: darkens the towers at night (multiplied by factor) */
export function tintCity(city: City, factor: THREE.ColorRepresentation): void {
  const f = new THREE.Color(factor);
  city.mats.forEach((m, i) => (m.uniforms.uColor.value as THREE.Color).set(CITY_BASE[i]).multiply(f));
}

// ───────────────────────── Star Gate ─────────────────────────

export interface Gate {
  group: THREE.Group;
  portal: THREE.ShaderMaterial;
  runes: THREE.MeshBasicMaterial;
  beam: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
  ringMat: SpiritMaterial;
  /** Stone (for darkening at night) */
  mats: SpiritMaterial[];
}

export const GATE_R = 4.4;
export const GATE_Y = 5.2;

export function buildGate(low: boolean): Gate {
  const group = new THREE.Group();
  const stone = sceneMaterial(0xdcd8e8, { rim: 0.4 });
  const dark = sceneMaterial(0x8a86a0, { rim: 0.3 });
  // Base and steps
  const base = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 7.2, 0.7, 24), dark);
  base.position.y = 0.35;
  group.add(base);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.8, 0.35, 24), dark);
  step.position.y = 0.17;
  group.add(step);
  // Gate ring (upright, facing +z)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(GATE_R, 0.42, 10, 48), stone);
  ring.position.y = GATE_Y;
  group.add(ring);
  // Two gate pillars
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, GATE_Y + 0.6, 10), stone);
    p.position.set(sx * (GATE_R + 0.9), (GATE_Y + 0.6) / 2 + 0.7, 0);
    group.add(p);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), stone);
    top.position.set(sx * (GATE_R + 0.9), GATE_Y + 1.5, 0);
    group.add(top);
  }
  // Runes: a ring of small gold stones around the ring
  const runes = glowMaterial(0xffd070, 0.05);
  const runeGeo = new THREE.BoxGeometry(0.22, 0.34, 0.14);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const m = new THREE.Mesh(runeGeo, runes);
    m.position.set(Math.cos(a) * GATE_R, GATE_Y + Math.sin(a) * GATE_R, 0.36);
    m.rotation.z = a;
    group.add(m);
  }
  // Door
  const portal = portalMaterial(low);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(GATE_R - 0.25, 48), portal);
  disc.position.set(0, GATE_Y, 0);
  group.add(disc);
  // Upward light pillar (two crossed light streaks)
  const beamMat = glowMat(0xa8e0ff, rayTex(), 0);
  const beam = new THREE.Group();
  for (const ry of [0, Math.PI / 2]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(5, 60), beamMat);
    pl.position.y = 30 + GATE_Y;
    pl.rotation.y = ry;
    beam.add(pl);
  }
  group.add(beam);
  // Stone gets outlines; the runes, door and light pillar are self-lit or have their own shaders, which inkScenery skips automatically
  inkScenery(group);
  return { group, portal, runes, beam: beam as unknown as THREE.Mesh, beamMat, ringMat: stone, mats: [stone, dark] };
}

const GATE_BASE = [0xdcd8e8, 0x8a86a0];
/** Tint of the Star Gate stone (darkened at night, multiplied by factor) */
export function tintGate(gate: Gate, factor: THREE.ColorRepresentation): void {
  const f = new THREE.Color(factor);
  gate.mats.forEach((m, i) => (m.uniforms.uColor.value as THREE.Color).set(GATE_BASE[i]).multiply(f));
}

/** The tall tower the masked figure stands on: a slender stone tower with a small platform at the top */
export function buildSpire(pos: THREE.Vector3, h: number): THREE.Group {
  const g = new THREE.Group();
  const stone = sceneMaterial(0x4a4868, { rim: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, h, 10), stone);
  body.position.y = h / 2;
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.2, 0.4, 10), stone);
  top.position.y = h + 0.2;
  g.add(top);
  g.position.copy(pos);
  inkScenery(g);
  return g;
}

// ───────────────────────── Characters ─────────────────────────
// Borrows the field's chibi character model (Avatar) without calling its update(); the storyboard poses it directly.
// The looks (long hair and headband, red scarf, hood and mask) are all written in PROLOGUE_LOOKS in avatar.ts, and this file only uses them.

/** Characters face +z: arms[0] is the right hand (the -x side), arms[1] is the left hand */
export interface Person {
  av: Avatar;
  g: THREE.Group;
  head: THREE.Group;
  arms: readonly THREE.Group[];
  legs: readonly THREE.Group[];
  torso: THREE.Group;
  /** World position of the palm */
  hand(i: number, out: THREE.Vector3): THREE.Vector3;
  forehead(out: THREE.Vector3): THREE.Vector3;
  /** Hands, feet and head return to a standing pose */
  rest(): void;
  update(dt: number): void;
}

const _local = new THREE.Vector3();

export function buildPerson(o: Outfit): Person {
  const av = new Avatar(o);
  const head = av.c.head;
  const rest = () => av.restPose();
  rest();
  return {
    av,
    g: av.root,
    head,
    arms: av.arms,
    legs: av.legs,
    torso: av.torso,
    hand(i, out) {
      return av.hands[i].getWorldPosition(out);
    },
    forehead(out) {
      _local.copy(av.foreheadLocal);
      return out.copy(head.localToWorld(_local));
    },
    rest,
    update(dt) {
      // Borrow only Creature's blinking and breathing; the head sway is decided by the storyboard
      const hx = head.rotation.x;
      const hy = head.rotation.y;
      const hz = head.rotation.z;
      av.c.update(dt);
      av.c.body.position.y = 0;
      head.rotation.set(hx, hy, hz);
    },
  };
}

/** Elda: the first contractor. Long dark hair, a gold headband, white clothes, a dark-blue cloak */
export const ELDA_LOOK: Outfit = PROLOGUE_LOOKS.elda;
/** The child: orange hair, a red scarf */
export const CHILD_LOOK: Outfit = PROLOGUE_LOOKS.child;
/** The masked figure: a hood, a floor-length robe, and a pale expressionless mask (the mask stays white even in silhouette) */
export const MASKED_LOOK: Outfit = { ...PROLOGUE_LOOKS.masked, scale: MASK_S };

// ───────────────────────── Heart of the World ─────────────────────────

export interface Heart {
  group: THREE.Group;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  glow: THREE.Sprite;
  glowMat: THREE.SpriteMaterial;
  halo: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
}

export function buildHeart(low: boolean, size: number): Heart {
  // Subdivided twice: from far away it reads as a crystal, and when pushed in the facets do not grow as big as a wall
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const r = rng(9);
  // The vertices are squeezed slightly into an irregular crystal
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)}|${pos.getY(i).toFixed(3)}|${pos.getZ(i).toFixed(3)}`;
    let k = seen.get(key);
    if (k === undefined) {
      k = 0.92 + r() * 0.16;
      seen.set(key, k);
    }
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * 1.55 * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const mat = heartMaterial(low);
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(mesh);
  const glowMatS = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xff6ab0).multiplyScalar(1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.6 });
  const glow = new THREE.Sprite(glowMatS);
  glow.scale.setScalar(6);
  group.add(glow);
  const haloMat = glowMat(0xffb0d8, ringTex(), 1.2);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), haloMat);
  halo.rotation.x = -Math.PI / 2;
  group.add(halo);
  group.scale.setScalar(size);
  return { group, mesh, mat, glow, glowMat: glowMatS, halo, haloMat };
}

// ───────────────────────── Source crystal fragments, meteors ─────────────────────────

export interface Shard {
  g: THREE.Group;
  core: THREE.Mesh;
  coreMat: THREE.MeshBasicMaterial;
  glow: THREE.Sprite;
  glowMat: THREE.SpriteMaterial;
  trail: THREE.Mesh;
  trailMat: THREE.MeshBasicMaterial;
  color: THREE.Color;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  dispose(): void;
}

let shardGeo: THREE.BufferGeometry | null = null;
let trailGeo: THREE.BufferGeometry | null = null;

/** A glowing crystal fragment with a halo and a trail; call place(pos) every frame to aim the trail along the direction of travel */
export function buildShard(color: THREE.ColorRepresentation, size = 0.5): Shard {
  shardGeo ??= new THREE.OctahedronGeometry(1, 0);
  trailGeo ??= new THREE.PlaneGeometry(1, 1);
  const col = new THREE.Color(color);
  const g = new THREE.Group();
  const coreMat = glowMaterial(col, 1.9);
  const core = new THREE.Mesh(shardGeo, coreMat);
  core.scale.set(size * 0.55, size, size * 0.55);
  g.add(core);
  const glowMatS = new THREE.SpriteMaterial({ map: glowTex(), color: col.clone().multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const glow = new THREE.Sprite(glowMatS);
  glow.scale.setScalar(size * 5);
  g.add(glow);
  const trailMat = glowMat(col, streakTex(), 1.6);
  const trail = new THREE.Mesh(trailGeo, trailMat);
  trail.visible = false;
  return {
    g,
    core,
    coreMat,
    glow,
    glowMat: glowMatS,
    trail,
    trailMat,
    color: col,
    pos: new THREE.Vector3(),
    prev: new THREE.Vector3(),
    dispose() {
      coreMat.dispose();
      glowMatS.dispose();
      trailMat.dispose();
    },
  };
}

const _axis = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _side = new THREE.Vector3();
const _nrm = new THREE.Vector3();
const _m4 = new THREE.Matrix4();

/** Stretch the trail between a→b and turn it toward the camera */
export function stretchTrail(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, cam: THREE.Vector3, width: number): void {
  _axis.subVectors(b, a);
  const len = _axis.length();
  if (len < 1e-4) {
    m.visible = false;
    return;
  }
  m.visible = true;
  _axis.divideScalar(len);
  _mid.addVectors(a, b).multiplyScalar(0.5);
  _side.subVectors(cam, _mid);
  _side.crossVectors(_axis, _side);
  if (_side.lengthSq() < 1e-8) _side.set(1, 0, 0).cross(_axis);
  _side.normalize();
  _nrm.crossVectors(_side, _axis).normalize();
  m.position.copy(_mid);
  m.quaternion.setFromRotationMatrix(_m4.makeBasis(_side, _axis, _nrm));
  m.scale.set(width, len, 1);
}

// ───────────────────────── Void Blight torrent, light pillars ─────────────────────────

export interface Torrent {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  /** The current path (for smoke along the way) */
  curve: THREE.CatmullRomCurve3 | null;
  /** Switch to another path (set per shot): points run from the source to the end, r0 / r1 are the thickness at the start and end */
  path(points: THREE.Vector3[], r0: number, r1: number): void;
}

export function buildTorrent(low: boolean): Torrent {
  const mat = torrentMaterial(low);
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 8;
  const tr: Torrent = {
    mesh,
    mat,
    curve: null,
    path(points, r0, r1) {
      mesh.geometry.dispose();
      tr.curve = new THREE.CatmullRomCurve3(points);
      mesh.geometry = taperedTube(tr.curve, low ? 48 : 90, low ? 10 : 16, r0, r1);
    },
  };
  return tr;
}

export interface Pillar {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
}

export function buildPillar(color: THREE.ColorRepresentation, radius = 0.9, height = 46): Pillar {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.3, height, 20, 1, true);
  geo.translate(0, height / 2, 0);
  const mat = pillarMaterial(color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.renderOrder = 11;
  return { mesh, mat };
}

// ───────────────────────── Sigil, dark chamber ─────────────────────────

/** Sigil: a small golden magic circle patch (billboard) */
export function buildSigil(color: THREE.ColorRepresentation = 0xffd24a): THREE.Sprite {
  const m = new THREE.SpriteMaterial({ map: runeCircleTex(3), color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(0.001);
  return s;
}

/** The dark chamber beneath the gate: a black box that encloses the camera and the dragon */
export function buildChamber(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(40, 24, 40), new THREE.MeshBasicMaterial({ color: 0x030208, side: THREE.BackSide, toneMapped: false }));
  return m;
}

export const lerpColor = (out: THREE.Color, a: THREE.Color, b: THREE.Color, k: number): THREE.Color => out.set(lerp(a.r, b.r, k), lerp(a.g, b.g, k), lerp(a.b, b.b, k));
