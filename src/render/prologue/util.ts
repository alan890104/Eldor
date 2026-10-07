// Small helpers for the prologue animation: easing curves, camera keyframe interpolation, simple 2D value noise (for terrain).

import * as THREE from 'three';

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Progress from 0 to 1 of t between a and b */
export const ramp = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const smooth = (x: number): number => x * x * (3 - 2 * x);
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3);
export const easeIn = (x: number): number => x * x * x;
export const easeInOut = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const outBack = (x: number): number => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
/** 0→1→0 bell curve (a in, b out) */
export const bump = (t: number, a: number, peak: number, b: number): number => (t < peak ? ramp(t, a, peak) : 1 - ramp(t, peak, b));

export type V3 = [number, number, number];

/** Camera keyframe: two keys at the same time mean a hard cut; ease sets the curve from the previous key to this one */
export interface CamKey {
  t: number;
  pos: V3;
  look: V3;
  /** Zoom factor (1 = original view) */
  fov?: number;
  ease?: (x: number) => number;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Interpolates the camera position / look-at target from the keyframes and returns the zoom factor */
export function camAt(lt: number, keys: CamKey[], pos: THREE.Vector3, look: THREE.Vector3): number {
  if (keys.length === 0) return 1;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= lt) i++;
  const k0 = keys[i];
  const k1 = keys[Math.min(i + 1, keys.length - 1)];
  const span = k1.t - k0.t;
  const raw = span <= 1e-6 ? 1 : clamp01((lt - k0.t) / span);
  const k = (k1.ease ?? easeInOut)(raw);
  _a.set(k0.pos[0], k0.pos[1], k0.pos[2]);
  _b.set(k1.pos[0], k1.pos[1], k1.pos[2]);
  pos.lerpVectors(_a, _b, k);
  _a.set(k0.look[0], k0.look[1], k0.look[2]);
  _b.set(k1.look[0], k1.look[1], k1.look[2]);
  look.lerpVectors(_a, _b, k);
  return lerp(k0.fov ?? 1, k1.fov ?? 1, k);
}

/** Deterministic pseudo-random numbers (the same seed gives the same result every time, so recordings can be compared) */
export function rng(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function hash2(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** 2D value noise (0 to 1) */
export function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

export function fbm2(x: number, y: number, oct = 4): number {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += noise2(x * f, y * f) * amp;
    f *= 2.1;
    amp *= 0.5;
  }
  return v;
}

/** Y-axis rotation that faces P (the model's front points to +z) */
export function faceTo(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
