// Spirit portraits: a small offscreen renderer draws the 3D model to an image, cached as a data URL for the cards.

import * as THREE from 'three';
import { buildCreature } from './species.ts';
import { LIGHT } from './toon.ts';
import { INK_LAYER, InkCore } from './ink.ts';
import { getSpirit } from '../data.ts';
import type { Creature } from './creature.ts';

/** Spirits not yet seen: the portrait and the pre-battle opponent preview use a silhouette in this color (the cards are deep purple, and pure black would blur into one mass) */
export const SILHOUETTE = 0x1a1430;
/**
 * Silhouettes in the 3D scene (the codex display stand) use pure black, same as the summon silhouettes: the scene has fog and post-process outlines,
 * so a deep-purple fill would be washed out by the fog, and inner lines darker than the fill would let the facial features show through; with pure black the inner lines and the fill are the same color
 */
export const SILHOUETTE_3D = 0x000000;

let renderer: THREE.WebGLRenderer | null = null;
/** Lab models ported into the game use the post-process outline, the same lines as the battle view */
let ink: InkCore | null = null;
const cache = new Map<string, string>();
const pending: { key: string; resolve: (s: string) => void; speciesId: string; stage: 1 | 2 | 3; silhouette: boolean }[] = [];
let busy = false;

function getInk(): InkCore {
  if (!ink) {
    ink = new InkCore();
    ink.ss = 1.5;
    ink.setSize(256, 256);
  }
  return ink;
}

function getRenderer(): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(256, 256);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  return renderer;
}

/**
 * Dye the whole spirit the silhouette color: spirit materials go through applyFlash (a lab model's eye highlights and gems follow via flashHooks),
 * old models' glowing parts and back-face outlines are recolored directly; special shaders with no white-flash parameter (starfield, light streaks) are swapped for an unlit material of the same color.
 * Shared by the portraits and the codex display stand; the spirit on the stand needs applyFlash again every frame (update decays the white flash)
 */
export function silhouetteCreature(c: Creature, color: THREE.ColorRepresentation = SILHOUETTE): void {
  c.setFlash(color, 1);
  c.applyFlash();
  for (const g of c.glows) g.color.set(color);
  for (const o of c.outlines) o.uniforms.uColor.value.set(color);
  const own = new Set<THREE.Material>([...c.mats, ...c.outlines, ...c.glows]);
  // Small unlit parts like eye highlights: their color before and after tone mapping does not match the spirit material's silhouette color, so two eye dots would show through the silhouette.
  // They all sit inside the outline, so hiding them does not change the silhouette's shape (turn off the layer rather than use visible: the model rewrites visible every frame when blinking)
  c.root.updateMatrixWorld(true);
  const tiny = new THREE.Box3().setFromObject(c.root).getSize(new THREE.Vector3()).y * 0.04;
  c.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || own.has(m.material) || !(m.material as THREE.MeshBasicMaterial).isMeshBasicMaterial) return;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const ws = m.getWorldScale(new THREE.Vector3());
    if (g.boundingSphere!.radius * Math.max(ws.x, ws.y, ws.z) < tiny) m.layers.disableAll();
  });
  c.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // The silhouette is the outline itself: turn off the outline layer, since the ink line is lighter than pure black and would leave a faint line showing through the silhouette
    m.layers.disable(INK_LAYER);
    if (Array.isArray(m.material)) return;
    const mat = m.material as THREE.ShaderMaterial;
    if (!mat || own.has(mat) || !mat.isShaderMaterial || mat.uniforms?.uFlash || mat.uniforms?.uColor) return;
    const dark = new THREE.MeshBasicMaterial({ color });
    mat.dispose();
    m.material = dark;
    // Registered in glows, so Creature.dispose cleans it up too
    c.glows.push(dark);
  });
}

export function thumbKey(speciesId: string, stage: number, silhouette = false): string {
  return `${speciesId}|${stage}|${silhouette ? 's' : ''}`;
}

export function cachedThumb(speciesId: string, stage: number, silhouette = false): string | undefined {
  return cache.get(thumbKey(speciesId, stage, silhouette));
}

export function requestThumb(speciesId: string, stage: 1 | 2 | 3, silhouette = false): Promise<string> {
  const key = thumbKey(speciesId, stage, silhouette);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    pending.push({ key, resolve, speciesId, stage, silhouette });
    pump();
  });
}

function pump(): void {
  if (busy) return;
  busy = true;
  const step = () => {
    const job = pending.shift();
    if (!job) {
      busy = false;
      return;
    }
    const hit = cache.get(job.key);
    if (hit) {
      job.resolve(hit);
      requestAnimationFrame(step);
      return;
    }
    const url = render(job.speciesId, job.stage, job.silhouette);
    cache.set(job.key, url);
    job.resolve(url);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Portrait framing: the camera direction is fixed (a slightly high, slightly right three-quarter angle), and the distance and center are computed from the model's actual vertices */
const VIEW_DIR = new THREE.Vector3(0.15, 0.18, 1).normalize();
const FOV = 30;
/** Fraction of the frame taken by the solid parts (the longer side), leaving 6% on each side */
const FILL = 0.88;
/** Glowing parts such as halos and wind rings only need to fit in the frame (leaving just 2% at the edge); the body need not shrink another step for them */
const GLOW_FILL = 0.96;

const _p = new THREE.Vector3();
const _im = new THREE.Matrix4();
const _wm = new THREE.Matrix4();

/**
 * Sample the model's vertices (world coordinates), split into solid parts and glowing parts. Old models' back-face outline shells and hidden parts do not count;
 * translucent, additive-blended and unlit MeshBasicMaterial parts count as glowing (halos, wind rings, flames).
 */
function sampleVerts(c: Creature): { solid: number[]; glow: number[] } {
  const solid: number[] = [];
  const glow: number[] = [];
  const hulls = new Set<THREE.Material>(c.outlines);
  c.root.updateMatrixWorld(true);
  c.root.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat || !mat.visible || hulls.has(mat) || mat.side === THREE.BackSide) return;
    const pos = m.geometry.getAttribute('position');
    if (!pos) return;
    const isGlow = mat.transparent || mat.blending === THREE.AdditiveBlending || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial;
    const out = isGlow ? glow : solid;
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh) : null;
    const n = inst ? inst.count : 1;
    for (let k = 0; k < n; k++) {
      if (inst) _wm.multiplyMatrices(m.matrixWorld, (inst.getMatrixAt(k, _im), _im));
      else _wm.copy(m.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        _p.fromBufferAttribute(pos, i).applyMatrix4(_wm);
        out.push(_p.x, _p.y, _p.z);
      }
    }
  });
  return { solid, glow };
}

/**
 * Fit a set of points in the frame under a perspective camera: back off D along the fixed direction and shift sideways by (sx, sy).
 * A point at (a, b, d) in camera space must satisfy |a - sx| ≤ k(d + D) (k = tan of the half field of view × the fill fraction),
 * so each axis's minimum distance is (max(a - kd) - min(a + kd)) / 2k, and the shift is the midpoint of the feasible interval.
 */
function fitAxis(pts: number[], o: THREE.Vector3, r: THREE.Vector3, u: THREE.Vector3, f: THREE.Vector3, k: number): { lo: [number, number]; hi: [number, number] } {
  // lo: max(a - kd), hi: min(a + kd), one pair each for x and y
  const lo: [number, number] = [-Infinity, -Infinity];
  const hi: [number, number] = [Infinity, Infinity];
  for (let i = 0; i < pts.length; i += 3) {
    const qx = pts[i] - o.x;
    const qy = pts[i + 1] - o.y;
    const qz = pts[i + 2] - o.z;
    const a = qx * r.x + qy * r.y + qz * r.z;
    const b = qx * u.x + qy * u.y + qz * u.z;
    const d = qx * f.x + qy * f.y + qz * f.z;
    lo[0] = Math.max(lo[0], a - k * d);
    hi[0] = Math.min(hi[0], a + k * d);
    lo[1] = Math.max(lo[1], b - k * d);
    hi[1] = Math.min(hi[1], b + k * d);
  }
  return { lo, hi };
}
/** Minimum distance at which both axes fit */
function minDist(lo: [number, number], hi: [number, number], k: number): number {
  return Math.max((lo[0] - hi[0]) / (2 * k), (lo[1] - hi[1]) / (2 * k));
}
/** Feasible shift interval at distance D */
function range(lo: number, hi: number, k: number, D: number): [number, number] {
  return [lo - k * D, hi + k * D];
}
/** Center the body; when the glowing parts must fit too, clamp into the intersection of the two intervals, and if that is impossible go by the body */
function pick(body: [number, number], glow: [number, number] | null): number {
  const mid = (body[0] + body[1]) / 2;
  if (!glow) return mid;
  const l = Math.max(body[0], glow[0]);
  const h = Math.min(body[1], glow[1]);
  return l <= h ? Math.min(h, Math.max(l, mid)) : mid;
}

function frameCamera(c: Creature, cam: THREE.PerspectiveCamera): void {
  const { solid, glow } = sampleVerts(c);
  const body = solid.length >= 9 ? solid : glow;
  const box = new THREE.Box3().setFromArray(body.length ? body : [0, 0, 0, 0, 1, 0]);
  const o = box.getCenter(new THREE.Vector3());
  // Camera basis: f points at the model, r to the right, u up (consistent with lookAt)
  const f = VIEW_DIR.clone().negate();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const u = new THREE.Vector3().crossVectors(r, f);
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const kb = t * FILL;
  const kg = t * GLOW_FILL;
  const b = fitAxis(body, o, r, u, f, kb);
  let D = minDist(b.lo, b.hi, kb);
  const all = body === solid && glow.length ? fitAxis(solid.concat(glow), o, r, u, f, kg) : null;
  if (all) D = Math.max(D, minDist(all.lo, all.hi, kg));
  // Keep at least a small distance beyond the near plane, so even a very flat model never puts the camera inside the body
  D = Math.max(D, box.getSize(new THREE.Vector3()).length() * 0.6, 0.5);
  const bx = range(b.lo[0], b.hi[0], kb, D);
  const by = range(b.lo[1], b.hi[1], kb, D);
  const sx = pick(bx, all && range(all.lo[0], all.hi[0], kg, D));
  const sy = pick(by, all && range(all.lo[1], all.hi[1], kg, D));
  const target = o.clone().addScaledVector(r, sx).addScaledVector(u, sy);
  cam.fov = FOV;
  cam.near = Math.max(0.01, D * 0.05);
  cam.far = D * 10;
  cam.position.copy(target).addScaledVector(f, -D);
  cam.lookAt(target);
  cam.updateProjectionMatrix();
}

function render(speciesId: string, stage: 1 | 2 | 3, silhouette: boolean): string {
  const r = getRenderer();
  const scene = new THREE.Scene();
  const saved = { d: LIGHT.dir.value.clone(), a: LIGHT.ambient.value.clone(), r: LIGHT.rimColor.value.clone(), s: LIGHT.shadowTint.value.clone() };
  LIGHT.dir.value.set(0.5, 0.8, 0.6).normalize();
  LIGHT.ambient.value.set(0x9a92c8);
  LIGHT.rimColor.value.set(0xfff0e0);
  LIGHT.shadowTint.value.set(0x6a5aa8);
  const c = buildCreature(speciesId, stage, getSpirit(speciesId).rarity);
  c.update(0.01);
  if (silhouette) silhouetteCreature(c);
  c.root.rotation.y = 0.55;
  scene.add(c.root);
  const cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  frameCamera(c, cam);
  r.setClearColor(0x000000, 0);
  // Silhouettes skip the post-process outline: the inner lines are darker than the fill and would show the features and parts through the dark silhouette
  if (c.ink && !silhouette) getInk().render(r, scene, cam, null);
  else r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  c.dispose();
  LIGHT.dir.value.copy(saved.d);
  LIGHT.ambient.value.copy(saved.a);
  LIGHT.rimColor.value.copy(saved.r);
  LIGHT.shadowTint.value.copy(saved.s);
  return url;
}
