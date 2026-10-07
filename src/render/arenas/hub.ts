// Star Gate City (hub / title / ending) and the Star Gate arena: a ring-shaped city built on the ruins of the kingdom, with the Star Gate towering in the center.
// The two modules share the Star Gate, the stairs and fountain, the guild and academy, and the lamplight of the ring city; the hub is a dusk market night (stalls, strings of lights, airships),
// and the arena is the same plaza on a tournament night (ring-shaped stands, waving spectators, spotlights, a sea of banners for the eight source crystals, and fireworks).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, tree, type ArenaCtx, type Palette, type PropBatch, type RegionModule } from '../arenaKit.ts';
import { glowTex, runeCircleTex } from '../textures.ts';
import { rayTex } from '../fxtex.ts';
import { LIGHT } from '../toon.ts';
import { inkScenery } from '../ink.ts';
import { sceneMaterial } from '../spiritToon.ts';

type Mode = 'hub' | 'arena';

/** Colors of the eight source crystals (water, fire, nature, wind, earth, thunder, light, dark) */
const GEMS = [0x3db7ff, 0xff6a2b, 0x5fcb5a, 0x9fe8e0, 0xc49a5a, 0xc8a0ff, 0xffe680, 0x9a5aff];
const STONE_LIGHT = 0xe8e2f6;
const STONE = 0xd2c8e8;
const STONE_DARK = 0x9a88c4;
const IRON = 0x3a3050;
const ROOF = 0x6a4ab0;
const ROOF2 = 0x4e3a92;
const WOOD = 0x8a6448;
const WOOD_DARK = 0x5e4230;
const LAMP = 0xffc870;
const LEAF = [0x9a7ad8, 0xb090ec, 0x8466c8];
const TRUNK = 0x5a4868;
const CLOTH = [0xff8a5a, 0xffd870, 0x7ad8ff, 0xff7ab0, 0x9affb0, 0xc8a0ff];
const GATE_Z = -26;
const FOUNTAIN_Z = -12;

/** Local offset with some base matrix as the origin (a building's parts all use the building's own coordinates) */
const rel = (base: THREE.Matrix4, x: number, y: number, z: number, ry = 0, s = 1, rx = 0, rz = 0) =>
  new THREE.Matrix4().multiplyMatrices(base, M(x, y, z, ry, s, rx, rz));
/** Make the building's front (local +z) face the center of the plaza */
const faceCenter = (x: number, z: number) => Math.atan2(-x, -z);

// ───────────────────────── Ground ─────────────────────────

/** Plaza ground: concentric flagstone rings and radial lines, the ring road around the city, the walkway to the Star Gate; the arena version has more distinct sectors and gold trim on the outer ring */
function plazaTex(mode: Mode): THREE.CanvasTexture {
  const s = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const c = s / 2;
  const u = s / 68; // Pixels per world unit (ground disc radius 34)
  let seed = mode === 'hub' ? 17 : 41;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const circle = (rad: number) => {
    g.beginPath();
    g.arc(c, c, rad * u, 0, Math.PI * 2);
  };
  // Surrounding land and turf
  g.fillStyle = mode === 'hub' ? '#8c7eb4' : '#7c6ea8';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 420; i++) {
    g.fillStyle = rnd() < 0.5 ? '#7a6aa4' : '#9a8cc0';
    g.globalAlpha = 0.12 + rnd() * 0.2;
    g.beginPath();
    g.ellipse(rnd() * s, rnd() * s, 10 + rnd() * 40, 8 + rnd() * 24, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // Ring road
  g.fillStyle = '#b2a6cc';
  circle(22.5);
  g.fill();
  g.fillStyle = mode === 'hub' ? '#8c7eb4' : '#7c6ea8';
  circle(19.5);
  g.fill();
  // Plaza
  g.fillStyle = mode === 'hub' ? '#d8cfe8' : '#cfc5e2';
  circle(17.6);
  g.fill();
  // Eight sectors alternating light and dark
  for (let k = 0; k < 8; k++) {
    if (k % 2) continue;
    g.fillStyle = '#b8a8d8';
    g.globalAlpha = mode === 'hub' ? 0.16 : 0.3;
    g.beginPath();
    g.moveTo(c, c);
    g.arc(c, c, 17.6 * u, (k / 8) * Math.PI * 2 + Math.PI / 8, ((k + 1) / 8) * Math.PI * 2 + Math.PI / 8);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
  // Walkway to the Star Gate (top of the canvas = world -z)
  g.fillStyle = mode === 'hub' ? '#e6dff2' : '#e0d8ee';
  g.fillRect(c - 3.2 * u, c - 17.6 * u, 6.4 * u, 11 * u);
  // Concentric ring lines and radial lines
  g.strokeStyle = '#9c8ec4';
  g.lineWidth = 3;
  for (const rad of [7.3, 9.8, 12.4, 15, 17.6]) {
    g.globalAlpha = rad === 17.6 ? 0.9 : 0.55;
    circle(rad);
    g.stroke();
  }
  g.globalAlpha = 0.35;
  g.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(c + Math.cos(a) * 7.3 * u, c + Math.sin(a) * 7.3 * u);
    g.lineTo(c + Math.cos(a) * 17.6 * u, c + Math.sin(a) * 17.6 * u);
    g.stroke();
  }
  g.globalAlpha = 1;
  // Center: a dark border ring outside the magic circle
  g.strokeStyle = mode === 'hub' ? '#8a78b8' : '#e2c46a';
  g.lineWidth = mode === 'hub' ? 5 : 7;
  circle(6.9);
  g.stroke();
  if (mode === 'arena') {
    // Arena: gold outer ring and eight-pointed star
    g.strokeStyle = '#e8c860';
    g.lineWidth = 9;
    g.globalAlpha = 0.85;
    circle(15.4);
    g.stroke();
    g.lineWidth = 3;
    g.globalAlpha = 0.5;
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = ((i * 3) / 8) * Math.PI * 2 - Math.PI / 2;
      const x = c + Math.cos(a) * 15.4 * u;
      const y = c + Math.sin(a) * 15.4 * u;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ───────────────────────── Waving flags (one mesh) ─────────────────────────

/** Flag set: each flag records its fixed edge (flagpole or crossbar) and phase, and the vertex shader sways it along the normal */
class FlagSet {
  private parts: THREE.BufferGeometry[] = [];

  /** hang 'pole': the left edge is fixed to a flagpole; 'bar': the top edge is fixed to a crossbar. style 0 plain, 1 band along the top edge, 2 swallowtail */
  add(w: number, h: number, m: THREE.Matrix4, color: number, hang: 'pole' | 'bar', phase: number, style = 0): void {
    const g = new THREE.PlaneGeometry(w, h, 6, 4);
    g.translate(hang === 'pole' ? w / 2 : 0, hang === 'pole' ? 0 : -h / 2, 0);
    const n = g.attributes.position.count;
    const uv = g.attributes.uv;
    const wave = new Float32Array(n);
    const info = new Float32Array(n * 2);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      wave[i] = hang === 'pole' ? uv.getX(i) : 1 - uv.getY(i);
      info[i * 2] = phase;
      info[i * 2 + 1] = style + (hang === 'pole' ? 0 : 10);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('aWave', new THREE.BufferAttribute(wave, 1));
    g.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.applyMatrix4(m);
    this.parts.push(g);
  }

  build(group: THREE.Group, disposers: (() => void)[]): THREE.ShaderMaterial | null {
    if (!this.parts.length) return null;
    const geo = mergeGeometries(this.parts);
    if (!geo) return null;
    const mat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: { value: 0 },
        uLightDir: LIGHT.dir,
        uBand: { value: new THREE.Color(0xffd870) },
      },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        uniform float uTime;
        attribute float aWave; attribute vec2 aInfo; attribute vec3 color;
        varying vec3 vN; varying vec3 vColor; varying vec2 vUv; varying float vFold; varying float vStyle;
        void main(){
          float k = aWave;
          float ph = uTime * 2.4 + aInfo.x + k * 5.5;
          float w = sin(ph) * 0.13 * k + sin(uTime * 4.3 + aInfo.x * 1.7 + k * 9.0) * 0.035 * k;
          vec3 p = position + normal * w;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vColor = color; vUv = uv; vFold = cos(ph) * k; vStyle = aInfo.y;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform vec3 uLightDir; uniform vec3 uBand;
        varying vec3 vN; varying vec3 vColor; varying vec2 vUv; varying float vFold; varying float vStyle;
        void main(){
          float style = mod(vStyle, 10.0);
          bool pole = vStyle < 10.0;
          // Swallowtail: a triangle is cut from the flag tail
          if (style > 1.5) {
            float tail = pole ? vUv.x : 1.0 - vUv.y;
            float across = pole ? abs(vUv.y - 0.5) : abs(vUv.x - 0.5);
            if (tail > 0.75 && across < 0.5 * (tail - 0.75) / 0.25) discard;
          }
          vec3 col = vColor;
          if (style > 0.5 && style < 1.5) {
            float edge = pole ? vUv.y : vUv.y;
            if (edge > 0.8) col = uBand;
          }
          float ndl = dot(normalize(vN), normalize(uLightDir));
          float lit = 0.72 + 0.28 * smoothstep(-0.1, 0.1, abs(ndl));
          col *= lit * (0.9 + 0.12 * vFold);
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }`,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    disposers.push(() => mat.dispose());
    return mat;
  }
}

/** Triangular pennant (double-sided), used on bunting */
function pennantGeo(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([-0.16, 0, 0, 0.16, 0, 0, 0, -0.36, 0, 0.16, 0, 0, -0.16, 0, 0, 0, -0.36, 0]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Bunting: a string of triangular pennants sagging between two points */
function bunting(b: PropBatch, a: THREE.Vector3, c: THREE.Vector3, colors: number[], n = 8): void {
  const dir = new THREE.Vector3().subVectors(c, a);
  const ry = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().addScaledVector(dir, t);
    p.y -= Math.sin(t * Math.PI) * 0.45;
    b.add(pennantGeo(), colors[i % colors.length], M(p.x, p.y, p.z, ry), false);
  }
}

// ───────────────────────── Buildings ─────────────────────────

/** House: stone walls, a sloped roof, a door, glowing windows; base sets position and orientation; with detail it adds floor lines, door eaves and window sills */
function house(b: PropBatch, base: THREE.Matrix4, w: number, d: number, h: number, wall: number, roof: number, r: () => number, winRows = 2, winSize = 1, detail = false, lined = true): void {
  b.add(new THREE.BoxGeometry(w, h, d), wall, rel(base, 0, h / 2, 0), lined);
  const k = d * 0.78;
  b.add(new THREE.BoxGeometry(w * 1.12, k, k), roof, rel(base, 0, h, 0, 0, 1, Math.PI / 4), lined);
  b.add(new THREE.BoxGeometry(0.9, 1.5, 0.12), WOOD_DARK, rel(base, 0, 0.75, d / 2 + 0.05), lined);
  if (detail) {
    b.add(new THREE.BoxGeometry(w + 0.2, 0.22, d + 0.2), WOOD_DARK, rel(base, 0, h * 0.5, 0));
    b.add(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), STONE_DARK, rel(base, 0, 0.15, 0));
    b.add(new THREE.BoxGeometry(1.6, 0.12, 0.7), roof, rel(base, 0, 1.65, d / 2 + 0.3));
    b.glow(new THREE.SphereGeometry(0.1, 6, 4), LAMP, rel(base, 0.9, 1.75, d / 2 + 0.3));
  }
  const cols = Math.max(1, Math.floor(w / 2.2));
  for (let row = 0; row < winRows; row++) {
    const wy = h * (0.55 + row * 0.3) / winRows + 0.4;
    for (let i = 0; i < cols; i++) {
      if (r() < 0.15) continue;
      const wx = (i - (cols - 1) / 2) * (w / cols);
      if (row === 0 && Math.abs(wx) < 0.8) continue;
      b.glow(new THREE.BoxGeometry(0.44 * winSize, 0.58 * winSize, 0.08), r() < 0.12 ? 0x9ad8ff : LAMP, rel(base, wx, wy, d / 2 + 0.05));
      if (detail) b.add(new THREE.BoxGeometry(0.6 * winSize, 0.08, 0.2), STONE_DARK, rel(base, wx, wy - 0.33 * winSize, d / 2 + 0.1));
    }
  }
  if (r() < 0.5) b.add(new THREE.BoxGeometry(0.5, 1.3, 0.5), STONE_DARK, rel(base, w * 0.3, h + k * 0.35, -d * 0.12), lined);
}

/** Tower: a cylindrical body, a conical top, a light at the tip and windows spiraling upward */
function tower(b: PropBatch, x: number, z: number, radius: number, h: number, wall: number, roof: number, r: () => number, tip = LAMP, lined = true): void {
  b.add(new THREE.CylinderGeometry(radius, radius * 1.08, h, 10), wall, M(x, h / 2, z), lined);
  b.add(new THREE.CylinderGeometry(radius * 1.25, radius * 1.25, 0.5, 10), STONE_DARK, M(x, h + 0.25, z), lined);
  b.add(new THREE.ConeGeometry(radius * 1.3, radius * 2.4, 10), roof, M(x, h + 0.5 + radius * 1.2, z), lined);
  b.glow(new THREE.OctahedronGeometry(0.28), tip, M(x, h + 0.5 + radius * 2.5, z));
  const n = Math.floor(h / 2.2);
  for (let i = 0; i < n; i++) {
    const a = i * 1.9 + r();
    b.glow(new THREE.BoxGeometry(0.36, 0.5, 0.08), LAMP, M(x + Math.cos(a) * radius, 1.6 + i * 2.2, z + Math.sin(a) * radius, -a + Math.PI / 2));
  }
}

/** Pactbearers' Guild headquarters: a hall, a dome, a portico colonnade and guild banners */
function guildHall(b: PropBatch, flags: FlagSet, x: number, z: number, r: () => number): void {
  const base = M(x, 0, z, faceCenter(x, z));
  b.add(new THREE.BoxGeometry(13, 7, 10), STONE_LIGHT, rel(base, 0, 3.5, 0));
  b.add(new THREE.BoxGeometry(14, 0.5, 11), STONE_DARK, rel(base, 0, 7.25, 0));
  b.add(new THREE.CylinderGeometry(4.2, 4.2, 1.6, 16), STONE, rel(base, 0, 8.3, 0));
  b.add(new THREE.SphereGeometry(4.0, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ROOF2, rel(base, 0, 9.1, 0));
  b.add(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), IRON, rel(base, 0, 14.1, 0));
  b.glow(new THREE.OctahedronGeometry(0.4), 0xffe680, rel(base, 0, 15.3, 0));
  // Portico
  b.add(new THREE.BoxGeometry(9, 0.5, 3), STONE_DARK, rel(base, 0, 5.5, 6.4));
  b.add(new THREE.BoxGeometry(9.4, 0.3, 3.4), STONE_LIGHT, rel(base, 0, 5.9, 6.4));
  for (let i = 0; i < 4; i++) {
    const px = -3.3 + i * 2.2;
    b.add(new THREE.CylinderGeometry(0.32, 0.36, 5.2, 9), STONE_LIGHT, rel(base, px, 2.6, 7.3));
    b.add(new THREE.BoxGeometry(0.9, 0.25, 0.9), STONE_DARK, rel(base, px, 5.15, 7.3));
  }
  b.add(new THREE.BoxGeometry(10, 0.4, 4.5), STONE, rel(base, 0, 0.2, 7.2));
  b.add(new THREE.BoxGeometry(2.2, 3.4, 0.2), WOOD_DARK, rel(base, 0, 1.7, 5.05));
  b.glow(new THREE.BoxGeometry(2.0, 0.5, 0.1), LAMP, rel(base, 0, 3.7, 5.08));
  for (const side of [-1, 1]) {
    b.glow(new THREE.BoxGeometry(0.8, 1.2, 0.1), LAMP, rel(base, side * 4, 2.6, 5.08));
    b.glow(new THREE.BoxGeometry(0.8, 1.2, 0.1), LAMP, rel(base, side * 4, 5.2, 5.08));
    for (let i = 0; i < 3; i++) b.glow(new THREE.BoxGeometry(0.1, 1.0, 0.7), r() < 0.2 ? 0x9ad8ff : LAMP, rel(base, side * 6.55, 2.2 + i * 1.8, -3 + i * 2.6));
  }
  // Guild banners: purple with a gold band, on flagpoles at both sides of the portico
  for (const side of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 6, 5), IRON, rel(base, side * 5.2, 3, 8.4));
    b.add(new THREE.BoxGeometry(1.7, 0.08, 0.08), IRON, rel(base, side * 5.2, 5.9, 8.4));
    flags.add(1.5, 2.8, rel(base, side * 5.2, 5.85, 8.4, side < 0 ? Math.PI / 2 : -Math.PI / 2), 0x6a3ab8, 'bar', side + 1, 1);
  }
}

/** Starvault Sage Tower: a tall tower, a stargazing dome, armillary rings rotating above the tower top, with a scriptorium annex beside it */
function academyTower(b: PropBatch, x: number, z: number): void {
  b.add(new THREE.CylinderGeometry(3.2, 3.6, 16, 12), STONE_LIGHT, M(x, 8, z));
  for (let i = 0; i < 3; i++) b.add(new THREE.CylinderGeometry(3.7, 3.7, 0.4, 12), STONE_DARK, M(x, 4.5 + i * 5, z));
  b.add(new THREE.CylinderGeometry(4.1, 3.4, 1.8, 12), STONE, M(x, 16.9, z));
  b.add(new THREE.SphereGeometry(3.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ROOF2, M(x, 17.8, z));
  b.add(new THREE.CylinderGeometry(0.35, 0.45, 3.6, 8), IRON, M(x + 1.6, 19.6, z + 0.6, 0.6, 1, -0.9));
  for (let i = 0; i < 7; i++) {
    const a = i * 1.35;
    b.glow(new THREE.BoxGeometry(0.4, 0.62, 0.08), i % 3 === 0 ? 0x9ad8ff : LAMP, M(x + Math.cos(a) * 3.35, 2.4 + i * 2.1, z + Math.sin(a) * 3.35, -a + Math.PI / 2));
  }
  // Armillary rings: three tilted glowing rings above the tower top
  for (let i = 0; i < 3; i++) b.glow(new THREE.TorusGeometry(2.2 + i * 0.5, 0.06, 6, 40), 0x8ab8ff, M(x, 23.5, z, i * 1.1, 1, 0.5 + i * 0.7, 0.3 * i));
  b.glow(new THREE.OctahedronGeometry(0.45), 0xbfe0ff, M(x, 23.5, z));
  // Annex
  const ry = faceCenter(x, z);
  const base = M(x, 0, z, ry);
  b.add(new THREE.BoxGeometry(9, 5, 6), STONE_LIGHT, rel(base, -6, 2.5, 2));
  b.add(new THREE.BoxGeometry(10, 4.7, 4.7), ROOF, rel(base, -6, 5, 2, 0, 1, Math.PI / 4));
  for (let i = 0; i < 3; i++) b.glow(new THREE.BoxGeometry(0.44, 0.6, 0.08), LAMP, rel(base, -8.5 + i * 2.5, 2.4, 5.05));
  b.add(new THREE.BoxGeometry(0.9, 1.5, 0.12), WOOD_DARK, rel(base, -6, 0.75, 5.05));
}

/** City gate: two towers flanking an archway that leads to the ring city (on the +z side of the plaza, visible when the title screen orbits to the back) */
function cityGate(b: PropBatch, flags: FlagSet, x: number, z: number): void {
  const ry = faceCenter(x, z);
  const base = M(x, 0, z, ry);
  for (const side of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(2.2, 2.4, 9, 10), STONE_LIGHT, rel(base, side * 5, 4.5, 0));
    b.add(new THREE.CylinderGeometry(2.6, 2.6, 0.6, 10), STONE_DARK, rel(base, side * 5, 9.3, 0));
    b.add(new THREE.ConeGeometry(2.7, 3.2, 10), ROOF, rel(base, side * 5, 11.2, 0));
    b.glow(new THREE.OctahedronGeometry(0.3), LAMP, rel(base, side * 5, 13, 0));
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 4, 5), IRON, rel(base, side * 5, 14, 0));
    flags.add(1.6, 1.0, rel(base, side * 5, 15.5, 0, Math.PI / 2), GEMS[side < 0 ? 6 : 0], 'pole', side * 2 + 5, 2);
    b.glow(new THREE.BoxGeometry(0.4, 0.55, 0.08), LAMP, rel(base, side * 5, 5.5, 2.25));
  }
  b.add(new THREE.BoxGeometry(7, 1.2, 3), STONE_DARK, rel(base, 0, 7.4, 0));
  b.add(new THREE.TorusGeometry(3.0, 0.55, 8, 20, Math.PI), STONE_LIGHT, rel(base, 0, 4.2, 0));
  b.add(new THREE.BoxGeometry(6.4, 0.5, 3.2), STONE_LIGHT, rel(base, 0, 8.2, 0));
  for (let i = 0; i < 5; i++) b.add(new THREE.BoxGeometry(0.7, 0.6, 0.7), STONE_LIGHT, rel(base, -2.8 + i * 1.4, 8.7, 0));
  b.glow(new THREE.BoxGeometry(1.4, 0.3, 0.1), LAMP, rel(base, 0, 6.6, 1.55));
}

/** Lamplight of the ring city: the inner ring is houses with roofs and windows clearly visible, the outer ring is silhouettes and towers in the fog; a patch of night sky is left directly behind the Star Gate. The outer ring and distant mountains get no outline */
function ringCity(b: PropBatch, r: () => number): void {
  const behindGate = (a: number) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) + Math.PI / 2) < 0.42;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const d = 46 + r() * 12;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (behindGate(a)) continue;
    if (i % 6 === 3) {
      tower(b, x, z, 1.8 + r() * 1.2, 9 + r() * 8, 0x5c4c90, 0x3e3072, r);
      continue;
    }
    const w = 5 + r() * 5;
    const h = 5 + r() * 6;
    house(b, M(x, 0, z, faceCenter(x, z) + (r() - 0.5) * 0.5), w, 5 + r() * 3, h, r() < 0.5 ? 0x5e5090 : 0x544684, r() < 0.5 ? 0x3e3072 : 0x4a3480, r, 2, 1.6);
  }
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + (r() - 0.5) * 0.15;
    const d = 68 + r() * 26;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (i % 4 === 1 || behindGate(a)) {
      if (behindGate(a) && i % 2) continue;
      tower(b, x, z, 2.6 + r() * 1.8, 14 + r() * 12, 0x4e4080, 0x362866, r, r() < 0.5 ? 0x9ad8ff : LAMP, false);
      continue;
    }
    const w = 9 + r() * 8;
    house(b, M(x, 0, z, faceCenter(x, z) + (r() - 0.5) * 0.6), w, 8 + r() * 4, 8 + r() * 10, 0x4c3e7c, 0x362866, r, 1, 2.4, false, false);
  }
  // Distant mountains: wide, low cones overlapping into a continuous ridge
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3;
    const d = 118 + r() * 24;
    const h = 8 + r() * 9;
    b.add(new THREE.ConeGeometry(36 + r() * 24, h, 7), 0x4a3c7c, M(Math.cos(a) * d, h / 2 - 1, Math.sin(a) * d, r() * 3), false);
  }
}

/** Street lamp: an iron pole, a lampshade, warm lamplight */
function lampPost(b: PropBatch, x: number, z: number, h = 2.8): void {
  b.add(new THREE.CylinderGeometry(0.07, 0.11, h, 6), IRON, M(x, h / 2, z));
  b.add(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 8), IRON, M(x, 0.07, z));
  b.add(new THREE.BoxGeometry(0.44, 0.07, 0.44), IRON, M(x, h + 0.42, z));
  b.add(new THREE.ConeGeometry(0.34, 0.25, 4), IRON, M(x, h + 0.56, z, Math.PI / 4));
  b.glow(new THREE.BoxGeometry(0.3, 0.36, 0.3), LAMP, M(x, h + 0.2, z));
}

/** String lights: a string of colored small lights sagging between two lamp posts */
function stringLights(b: PropBatch, a: [number, number], c: [number, number], y: number): void {
  const n = 11;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a[0] + (c[0] - a[0]) * t;
    const z = a[1] + (c[1] - a[1]) * t;
    b.glow(new THREE.SphereGeometry(0.075, 6, 4), [0xffd070, 0xff9ab0, 0x9ad8ff][i % 3], M(x, y - Math.sin(t * Math.PI) * 0.75, z));
  }
}

/** Market stall: wooden posts, an awning, goods on the counter, barrels and small lanterns */
function stall(b: PropBatch, base: THREE.Matrix4, cloth: number, r: () => number): void {
  for (const [px, pz] of [[-1.25, -0.85], [1.25, -0.85], [-1.25, 0.85], [1.25, 0.85]]) b.add(new THREE.CylinderGeometry(0.06, 0.07, 2.3, 5), WOOD, rel(base, px, 1.15, pz));
  b.add(new THREE.ConeGeometry(2.15, 0.85, 4), cloth, rel(base, 0, 2.72, 0, Math.PI / 4));
  b.add(new THREE.BoxGeometry(3.0, 0.12, 2.2), 0xfff4e0, rel(base, 0, 2.32, 0));
  b.add(new THREE.BoxGeometry(2.6, 0.9, 0.9), WOOD, rel(base, 0, 0.45, 0.5));
  b.add(new THREE.BoxGeometry(2.7, 0.08, 1.0), WOOD_DARK, rel(base, 0, 0.94, 0.5));
  for (let i = 0; i < 5; i++) {
    const gx = -1 + i * 0.5;
    if (r() < 0.55) b.add(new THREE.SphereGeometry(0.16, 8, 6), [0xff6a4a, 0xffd040, 0x9ad06a, 0xff9ad0][i % 4], rel(base, gx, 1.14, 0.45 + (r() - 0.5) * 0.3));
    else b.add(new THREE.BoxGeometry(0.34, 0.3, 0.34), 0xb08a5a, rel(base, gx, 1.13, 0.45, r()));
  }
  b.add(new THREE.CylinderGeometry(0.32, 0.3, 0.7, 8), WOOD_DARK, rel(base, -1.75, 0.35, 0.2));
  b.add(new THREE.BoxGeometry(0.6, 0.6, 0.6), 0xa07a50, rel(base, 1.8, 0.3, 0.1, 0.3));
  b.glow(new THREE.SphereGeometry(0.14, 8, 6), 0xff9a60, rel(base, 1.15, 2.1, 0.95));
  const p0 = new THREE.Vector3(-1.4, 2.28, 1.0).applyMatrix4(base);
  const p1 = new THREE.Vector3(1.4, 2.28, 1.0).applyMatrix4(base);
  bunting(b, p0, p1, [cloth, 0xfff4e0, GEMS[6]], 7);
}

/** Brazier: flames on a stone pillar (particles are added in extras) */
function brazier(b: PropBatch, x: number, z: number): void {
  b.add(new THREE.CylinderGeometry(0.35, 0.5, 1.6, 8), STONE_DARK, M(x, 0.8, z));
  b.add(new THREE.CylinderGeometry(0.7, 0.4, 0.5, 10), IRON, M(x, 1.8, z));
  b.glow(new THREE.SphereGeometry(0.45, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xff9a40, M(x, 1.95, z));
}

// ───────────────────────── Star Gate ─────────────────────────

/** Starry vortex inside the Star Gate: spiral arms, rotating stars, a bright edge */
function vortexMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float arm = sin(a * 3.0 - r * 9.0 + uTime * 0.8);
        float arms = smoothstep(0.1, 0.9, arm) * (1.0 - r * 0.5);
        float rot = uTime * 0.1;
        vec2 q = vec2(cos(rot) * p.x - sin(rot) * p.y, sin(rot) * p.x + cos(rot) * p.y);
        vec2 cell = floor(q * 20.0);
        float h = hash(cell);
        vec2 f = fract(q * 20.0) - 0.5 - (vec2(hash(cell + 1.3), hash(cell + 5.7)) - 0.5) * 0.6;
        float star = smoothstep(0.14, 0.0, length(f)) * step(0.84, h) * (0.6 + 0.4 * sin(uTime * 3.0 + h * 50.0));
        vec3 deep = vec3(0.03, 0.05, 0.22);
        vec3 blue = vec3(0.3, 0.5, 1.0);
        vec3 col = mix(deep, blue, arms * 0.75 + r * 0.3);
        col += vec3(0.9, 0.95, 1.0) * star * 1.8;
        col += blue * smoothstep(0.78, 1.0, r) * 1.3;
        col += vec3(0.6, 0.8, 1.0) * smoothstep(0.25, 0.0, r) * 0.8;
        gl_FragColor = vec4(col, 0.96);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Halos of the source crystals: eight point sprites, each with its own color and breathing rhythm */
function gemHalos(positions: THREE.Vector3[], disposers: (() => void)[]): { points: THREE.Points; mat: THREE.ShaderMaterial } {
  const n = positions.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const ph = new Float32Array(n);
  positions.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3);
    const c = new THREE.Color(GEMS[i % GEMS.length]);
    col.set([c.r, c.g, c.b], i * 3);
    ph[i] = i * 0.8;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, tMap: { value: glowTex() }, uScale: { value: 900 } },
    vertexShader: /* glsl */ `
      attribute float aPhase; attribute vec3 color; uniform float uTime; uniform float uScale;
      varying vec3 vColor; varying float vPulse;
      void main(){
        vColor = color;
        vPulse = 0.75 + 0.25 * sin(uTime * 1.6 + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (2.6 + 0.5 * vPulse) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap; varying vec3 vColor; varying float vPulse;
      void main(){ vec4 t = texture2D(tMap, gl_PointCoord); gl_FragColor = vec4(vColor * 1.6 * vPulse, t.a * 0.7); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  disposers.push(() => mat.dispose());
  return { points, mat };
}

/** Fountain water surface: ripples spreading outward ring by ring */
function waterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float ring = smoothstep(0.55, 1.0, sin(r * 16.0 - uTime * 3.5) * 0.5 + 0.5);
        float ring2 = smoothstep(0.7, 1.0, sin(r * 9.0 + p.x * 4.0 - uTime * 2.0) * 0.5 + 0.5);
        vec3 col = mix(vec3(0.3, 0.55, 0.95), vec3(0.75, 0.92, 1.0), ring * 0.55 + ring2 * 0.35 + smoothstep(0.75, 1.0, r) * 0.4);
        gl_FragColor = vec4(col, 0.9);
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
}

/** Star Gate, base steps, fountain and braziers; returns what must be updated every frame */
function buildGate(ctx: ArenaCtx): void {
  const { group, b, r, extras, disposers } = ctx;
  const GZ = GATE_Z;
  // Base: four concentric round platforms, the top one with a ring of dark border
  for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(11.5 - i * 0.9, 11.5 - i * 0.9, 0.32, 56), i % 2 ? STONE : STONE_LIGHT, M(0, 0.16 + i * 0.3, GZ));
  b.add(new THREE.TorusGeometry(7.6, 0.14, 4, 64), STONE_DARK, M(0, 1.36, GZ, 0, 1, Math.PI / 2), false);
  // Stone seat
  b.add(new THREE.BoxGeometry(7.4, 0.7, 2.8), STONE_DARK, M(0, 1.55, GZ));
  b.add(new THREE.BoxGeometry(8.2, 0.24, 3.4), STONE_LIGHT, M(0, 2.0, GZ));
  for (const side of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.5, 0.6, 1.9, 8), STONE_LIGHT, M(side * 4.6, 2.15, GZ));
    b.add(new THREE.BoxGeometry(1.3, 0.3, 1.3), STONE_DARK, M(side * 4.6, 3.2, GZ));
    b.glow(new THREE.OctahedronGeometry(0.3), 0x8ab8ff, M(side * 4.6, 3.7, GZ));
  }
  // Outer ring: a heavy stone ring, with the 8 source crystals on it each in its own mount
  const R = 5.6;
  const CY = 2.1 + R + 0.65;
  b.add(new THREE.TorusGeometry(R, 0.66, 14, 80), STONE_LIGHT, M(0, CY, GZ));
  const gemPos: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
    const gx = Math.cos(a) * R;
    const gy = CY + Math.sin(a) * R;
    b.add(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 8), STONE_DARK, M(gx, gy, GZ + 0.5, 0, 1, Math.PI / 2));
    b.add(new THREE.TorusGeometry(0.7, 0.1, 6, 16), 0xd8c070, M(gx, gy, GZ + 0.76));
    b.glow(new THREE.OctahedronGeometry(0.5), GEMS[i], M(gx, gy, GZ + 0.8, 0, 1, 0, r() * 3));
    gemPos.push(new THREE.Vector3(gx, gy, GZ + 0.95));
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    b.add(new THREE.BoxGeometry(0.5, 0.5, 0.3), STONE_DARK, M(Math.cos(a) * R, CY + Math.sin(a) * R, GZ + 0.6, 0, 1, 0, a));
  }
  // Inner ring: a thinner stone ring turning slowly, with rune grooves on it
  const innerGeo = mergeGeometries([
    new THREE.TorusGeometry(R - 1.05, 0.34, 10, 72),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const g = new THREE.BoxGeometry(0.7, 0.42, 0.5);
      g.applyMatrix4(M(Math.cos(a) * (R - 1.05), Math.sin(a) * (R - 1.05), 0, 0, 1, 0, a));
      return g;
    }),
  ]);
  const innerMat = sceneMaterial(STONE, { rim: 0.5 });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.position.set(0, CY, GZ + 0.85);
  group.add(inner);
  inkScenery(inner);
  // Vortex and rune ring
  const vortexMat = vortexMaterial();
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(R - 0.85, 64), vortexMat);
  vortex.position.set(0, CY, GZ + 0.15);
  group.add(vortex);
  const runeMat = new THREE.MeshBasicMaterial({ map: runeCircleTex(5), color: new THREE.Color(0x9ab8ff).multiplyScalar(1.5), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const rune = new THREE.Mesh(new THREE.PlaneGeometry((R - 0.6) * 2, (R - 0.6) * 2), runeMat);
  rune.position.set(0, CY, GZ + 0.3);
  group.add(rune);
  const halos = gemHalos(gemPos, disposers);
  group.add(halos.points);
  // Light pillar shooting from the gate into the night sky
  const beamMat = new THREE.MeshBasicMaterial({ map: rayTex(), color: new THREE.Color(0x7aa8ff).multiplyScalar(0.9), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 2; i++) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 46), beamMat);
    beam.position.set(0, CY + 21, GZ);
    beam.rotation.y = (i * Math.PI) / 2;
    group.add(beam);
  }
  // Fountain
  const FZ = FOUNTAIN_Z;
  b.add(new THREE.CylinderGeometry(3.0, 3.2, 0.3, 28), STONE_LIGHT, M(0, 0.15, FZ));
  b.add(new THREE.CylinderGeometry(2.6, 2.75, 0.5, 28), STONE, M(0, 0.55, FZ));
  b.add(new THREE.TorusGeometry(2.55, 0.16, 6, 28), STONE_LIGHT, M(0, 0.8, FZ, 0, 1, Math.PI / 2));
  b.add(new THREE.CylinderGeometry(0.4, 0.55, 1.6, 12), STONE_DARK, M(0, 1.4, FZ));
  b.add(new THREE.CylinderGeometry(1.15, 0.85, 0.35, 16), STONE_LIGHT, M(0, 2.3, FZ));
  b.glow(new THREE.OctahedronGeometry(0.22), 0x5a8ae0, M(0, 2.9, FZ));
  const waterMat = waterMaterial();
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.45, 32), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.72, FZ);
  group.add(water);
  const water2 = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), waterMat);
  water2.rotation.x = -Math.PI / 2;
  water2.position.set(0, 2.49, FZ);
  group.add(water2);
  // Braziers beside the stairs
  brazier(b, -6.4, -15.4);
  brazier(b, 6.4, -15.4);

  disposers.push(() => {
    innerMat.dispose();
    vortexMat.dispose();
    runeMat.dispose();
    beamMat.dispose();
    waterMat.dispose();
  });
  let jetT = 0;
  let fireT = 0;
  extras.push((dt, t, vfx) => {
    inner.rotation.z = t * 0.12;
    rune.rotation.z = -t * 0.08;
    vortexMat.uniforms.uTime.value = t;
    halos.mat.uniforms.uTime.value = t;
    waterMat.uniforms.uTime.value = t;
    jetT += dt;
    while (jetT > 0.045) {
      jetT -= 0.045;
      vfx.emit({ pos: new THREE.Vector3(0, 2.9, FZ), count: 1, color: [0xbfe8ff, 0xffffff], speed: [2.6, 3.6], dir: new THREE.Vector3(0, 1, 0), spread: 0.55, gravity: 8, life: [0.75, 0.95], size: [0.08, 0.14], sizeEnd: 0.6, intensity: 1.3 });
    }
    fireT += dt;
    while (fireT > 0.08) {
      fireT -= 0.08;
      for (const x of [-6.4, 6.4]) vfx.emit({ pos: new THREE.Vector3(x, 2.1, -15.4), count: 1, color: [0xff7a20, 0xffc040], speed: [0.8, 1.6], dir: new THREE.Vector3(0, 1, 0), spread: 0.3, life: [0.5, 0.9], size: [0.25, 0.45], sizeEnd: 0.2, drag: 1, intensity: 1.8, radius: 0.25 });
    }
  });
}

// ───────────────────────── Arena stands ─────────────────────────

/** One tier of the stands: the inner riser (facing inward) + the tread (facing up), built only for the given angle range */
function tierGeo(rIn: number, rOut: number, y0: number, y1: number, t0: number, t1: number, segs: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ref: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(ref) < 0) [b, c] = [c, b];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < segs; i++) {
    const a0 = t0 + ((t1 - t0) * i) / segs;
    const a1 = t0 + ((t1 - t0) * (i + 1)) / segs;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    const inward = new THREE.Vector3(-(c0 + c1), 0, -(s0 + s1));
    const A = new THREE.Vector3(c0 * rIn, y0, s0 * rIn);
    const B = new THREE.Vector3(c1 * rIn, y0, s1 * rIn);
    const C = new THREE.Vector3(c1 * rIn, y1, s1 * rIn);
    const D = new THREE.Vector3(c0 * rIn, y1, s0 * rIn);
    const E = new THREE.Vector3(c0 * rOut, y1, s0 * rOut);
    const F = new THREE.Vector3(c1 * rOut, y1, s1 * rOut);
    tri(A, B, C, inward);
    tri(A, C, D, inward);
    tri(D, C, F, up);
    tri(D, F, E, up);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Stand end wall: an upright polygon following the stair profile (double-sided), placed on the radial plane at the given angle */
function endCapGeo(profile: [number, number][], angle: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const P = (p: [number, number]) => new THREE.Vector3(c * p[0], p[1], s * p[0]);
  const pivot = P(profile[profile.length - 1]);
  for (let i = 0; i < profile.length - 2; i++) {
    const a = P(profile[i]);
    const b = P(profile[i + 1]);
    pos.push(pivot.x, pivot.y, pivot.z, a.x, a.y, a.z, b.x, b.y, b.z);
    pos.push(pivot.x, pivot.y, pivot.z, b.x, b.y, b.z, a.x, a.y, a.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** One kind of spectator part (body, pennant, pole): an InstancedMesh, with only each instance's height changed every frame */
interface CrowdPart {
  mesh: THREE.InstancedMesh;
  /** Each instance's base height, bounce phase and wave phase */
  y: number[];
  ph: number[];
  wave: number[];
}

function crowdPart(geo: THREE.BufferGeometry, mat: THREE.Material, items: { m: THREE.Matrix4; c: THREE.Color; ph: number; wave: number }[]): CrowdPart {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, it.m);
    mesh.setColorAt(i, it.c);
  });
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  // The outline is only computed within the screen extent of the ink-layer objects, taken from the geometry's bounding sphere; the instances are scattered around the whole ring of stands, so the bounding sphere must cover the stands
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 28);
  return { mesh, y: items.map((it) => it.m.elements[13]), ph: items.map((it) => it.ph), wave: items.map((it) => it.wave) };
}

/** Ring-shaped stands: five tiers, with the gap facing the Star Gate; spectators are colored small blocks doing the wave; a ring of colored lights and a sea of banners along the top */
function buildStands(ctx: ArenaCtx, flags: FlagSet): { update: (t: number) => void } {
  const { group, b, r, disposers } = ctx;
  const gap = 0.62;
  const t0 = -Math.PI / 2 + gap;
  const t1 = (3 * Math.PI) / 2 - gap;
  const R0 = 15.6;
  const STEP = 1.9;
  const H = 0.78;
  const tiers = 5;
  for (let k = 0; k < tiers; k++) {
    const rIn = R0 + k * STEP;
    b.add(tierGeo(rIn, rIn + STEP, k * H, (k + 1) * H, t0, t1, 84), k % 2 ? STONE : STONE_LIGHT, new THREE.Matrix4());
  }
  const rBack = R0 + tiers * STEP;
  const topY = tiers * H;
  // Back wall (double-sided) and parapet
  b.add(tierGeo(rBack, rBack + 0.8, topY, topY + 3.2, t0, t1, 84), STONE_DARK, new THREE.Matrix4());
  b.add(new THREE.CylinderGeometry(rBack + 0.8, rBack + 0.8, 3.2, 84, 1, true, Math.PI / 2 - t1, t1 - t0), STONE_DARK, M(0, topY + 1.6, 0));
  b.add(new THREE.TorusGeometry(rBack + 0.4, 0.3, 6, 96, t1 - t0), STONE_LIGHT, M(0, topY + 3.3, 0, 0, 1, Math.PI / 2, 0).multiply(new THREE.Matrix4().makeRotationZ(-t0)));
  // Side walls at both ends (following the stair profile) and towers, framing the entrance to the Star Gate
  const profile: [number, number][] = [[R0, 0]];
  for (let k = 0; k < tiers; k++) profile.push([R0 + k * STEP, (k + 1) * H], [R0 + (k + 1) * STEP, (k + 1) * H]);
  profile.push([rBack, topY + 3.2], [rBack + 0.8, topY + 3.2], [rBack + 0.8, 0]);
  for (const a of [t0, t1]) {
    const cx = Math.cos(a);
    const sz = Math.sin(a);
    b.add(endCapGeo(profile, a), STONE_DARK, new THREE.Matrix4());
    tower(b, cx * (rBack + 0.4), sz * (rBack + 0.4), 1.6, 8, STONE_LIGHT, ROOF, r, 0xffe680);
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 4, 5), IRON, M(cx * (rBack + 0.4), 14.6, sz * (rBack + 0.4)));
    flags.add(1.8, 1.1, M(cx * (rBack + 0.4), 16.2, sz * (rBack + 0.4), -a), GEMS[6], 'pole', a, 2);
  }
  // Spectators: body, pennant and pole are each one InstancedMesh (the same MeshToon shading and post-process outline as the other props).
  // The old version wrote the wave in the vertex shader, drawing one phase per vertex; the outline pass cannot see vertex displacement, so instances are now moved on the CPU.
  // The random numbers are consumed per vertex as in the old version, so the positions of the other props behind the stands do not change
  type Fan = { m: THREE.Matrix4; c: THREE.Color; ph: number; wave: number };
  const bodyGeo = new THREE.BoxGeometry(0.42, 0.52, 0.4).toNonIndexed();
  const flagGeo = pennantGeo();
  const stickGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4).toNonIndexed();
  const spend = (n: number) => {
    const v = r();
    for (let i = 1; i < n; i++) r();
    return v;
  };
  const bodies: Fan[] = [];
  const pennants: Fan[] = [];
  const sticks: Fan[] = [];
  const palette = [0xff6a5a, 0xffd050, 0x5ad0ff, 0xff8ad0, 0x8aff9a, 0xf4f0ff, 0xc0a0ff, 0xffa060];
  for (let k = 0; k < tiers; k++) {
    const rad = R0 + k * STEP + 1.15;
    const n = Math.floor(((t1 - t0) * rad) / 0.85);
    for (let i = 0; i < n; i++) {
      if (r() < 0.12) continue;
      const a = t0 + ((t1 - t0) * (i + 0.5)) / n + (r() - 0.5) * 0.02;
      const x = Math.cos(a) * (rad + (r() - 0.5) * 0.5);
      const z = Math.sin(a) * (rad + (r() - 0.5) * 0.5);
      const y = (k + 1) * H;
      const col = new THREE.Color(palette[Math.floor(r() * palette.length)]);
      const flag = r() < 0.3;
      const ph = spend(bodyGeo.attributes.position.count) * 6.28;
      bodies.push({ m: M(x, y + 0.26, z, -a), c: col, ph, wave: a * 3.0 });
      if (flag) {
        const fc = new THREE.Color(GEMS[Math.floor(r() * 8)]);
        spend(flagGeo.attributes.position.count);
        pennants.push({ m: M(x, y + 0.95, z, -a + Math.PI / 2, 1.1, 0, Math.PI), c: fc, ph, wave: a * 3.0 });
        const sc = new THREE.Color(GEMS[Math.floor(r() * 8)]);
        spend(stickGeo.attributes.position.count);
        sticks.push({ m: M(x, y + 0.7, z), c: sc, ph, wave: a * 3.0 });
      }
    }
  }
  const crowdMat = sceneMaterial(0xffffff);
  const crowd = [crowdPart(bodyGeo, crowdMat, bodies), crowdPart(flagGeo, crowdMat, pennants), crowdPart(stickGeo, crowdMat, sticks)];
  const lined = new THREE.Group();
  lined.add(crowd[0].mesh, crowd[1].mesh);
  group.add(lined, crowd[2].mesh);
  // The poles are thinner than a pixel, so the outline would leave only broken dots; no outline
  inkScenery(lined);
  disposers.push(() => {
    crowdMat.dispose();
    for (const c of crowd) c.mesh.dispose();
  });
  const update = (t: number) => {
    for (const c of crowd) {
      const arr = c.mesh.instanceMatrix.array as Float32Array;
      for (let i = 0; i < c.y.length; i++) {
        // The wave travels once around the stands, while everyone else bounces in small amounts on their own
        const w = Math.sin(c.wave[i] - t * 1.4);
        const k = Math.min(1, Math.max(0, (w - 0.6) / 0.4));
        arr[i * 16 + 13] = c.y[i] + Math.max(0, Math.sin(t * 3.2 + c.ph[i])) * 0.1 + k * k * (3 - 2 * k) * 0.5;
      }
      c.mesh.instanceMatrix.needsUpdate = true;
    }
  };
  // Colored lights on the parapet and the big banners of the eight source crystals
  const nl = 60;
  for (let i = 0; i <= nl; i++) {
    const a = t0 + ((t1 - t0) * i) / nl;
    b.glow(new THREE.SphereGeometry(0.13, 6, 4), GEMS[i % 8], M(Math.cos(a) * (rBack + 0.4), topY + 3.7, Math.sin(a) * (rBack + 0.4)));
  }
  // The big banners of the eight source crystals hang on the inside of the back wall (the camera is very low, and hanging too high would leave the frame), with flagpoles and source crystal lights on top of the wall
  for (let i = 0; i < 8; i++) {
    const a = t0 + ((t1 - t0) * (i + 0.5)) / 8;
    const x = Math.cos(a) * (rBack + 0.4);
    const z = Math.sin(a) * (rBack + 0.4);
    b.add(new THREE.CylinderGeometry(0.07, 0.09, 3.5, 6), IRON, M(x, topY + 3.3 + 1.75, z));
    b.glow(new THREE.OctahedronGeometry(0.22), GEMS[i], M(x, topY + 7.0, z));
    const fx = Math.cos(a) * (rBack - 0.15);
    const fz = Math.sin(a) * (rBack - 0.15);
    b.add(new THREE.BoxGeometry(2.4, 0.12, 0.12), IRON, M(fx, topY + 3.05, fz, -a));
    flags.add(2.1, 2.7, M(fx, topY + 3.0, fz, -a), GEMS[i], 'bar', i * 0.9, 1);
  }
  // Gold halo at the foot of the stands (outlines the arena's boundary)
  b.glow(new THREE.TorusGeometry(15.35, 0.06, 5, 96), 0xffd870, M(0, 0.05, 0, 0, 1, Math.PI / 2));
  return { update };
}

/** Spotlights: light stands atop the stands and sweeping light cones */
function buildSpotlights(ctx: ArenaCtx): { pivots: THREE.Group[]; mats: THREE.ShaderMaterial[] } {
  const { group, b, disposers } = ctx;
  const pivots: THREE.Group[] = [];
  const mats: THREE.ShaderMaterial[] = [];
  const cols = [0xffd080, 0xff70c0, 0x60c8ff, 0xb090ff];
  // The lights on the left and right sweep across the arena, and the two on the +z side shine toward the Star Gate (the low-angle camera is the only one that sees the beams)
  const angles = [0, Math.PI, Math.PI / 4, (3 * Math.PI) / 4];
  angles.forEach((a, i) => {
    const x = Math.cos(a) * 25.9;
    const z = Math.sin(a) * 25.9;
    const y = 3.9 + 3.3;
    b.add(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6), IRON, M(x, y + 1.2, z));
    b.add(new THREE.BoxGeometry(0.9, 0.7, 0.9), IRON, M(x, y + 2.6, z, -a));
    b.glow(new THREE.SphereGeometry(0.26, 8, 6), cols[i], M(x, y + 2.6, z));
    const geo = new THREE.ConeGeometry(2.6, 40, 18, 1, true);
    geo.translate(0, -20, 0);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(cols[i]) } },
      vertexShader: /* glsl */ `
        varying float vT; varying vec3 vN; varying vec3 vV;
        void main(){
          vT = position.z / 40.0;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vT; varying vec3 vN; varying vec3 vV;
        void main(){
          // Draw front faces only: when the camera enters the beam its walls are not visible, so the whole screen does not wash out to white
          float edge = abs(dot(normalize(vN), normalize(vV)));
          float a = pow(max(1.0 - vT, 0.0), 1.4) * smoothstep(0.0, 0.06, vT) * 0.55 * edge;
          gl_FragColor = vec4(uColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.frustumCulled = false;
    const pivot = new THREE.Group();
    pivot.position.set(x, y + 2.6, z);
    pivot.add(cone);
    group.add(pivot);
    pivots.push(pivot);
    mats.push(mat);
  });
  disposers.push(() => {
    for (const m of mats) m.dispose();
  });
  return { pivots, mats };
}

/** Airship: a small blimp cruising slowly around the city, with a lamp hanging under the gondola */
function buildAirship(group: THREE.Group, disposers: (() => void)[]): THREE.Group {
  const g = new THREE.Group();
  const hull = new THREE.SphereGeometry(1, 14, 10);
  hull.scale(3.2, 1.15, 1.15);
  const fin1 = new THREE.BoxGeometry(1.2, 0.9, 0.08);
  fin1.translate(-2.4, 0.5, 0);
  const fin2 = new THREE.BoxGeometry(1.2, 0.08, 0.9);
  fin2.translate(-2.4, 0, 0);
  const gondola = new THREE.BoxGeometry(1.5, 0.55, 0.7);
  gondola.translate(0.2, -1.35, 0);
  const geo = mergeGeometries([hull, fin1, fin2, gondola]);
  const mat = sceneMaterial(0xe4d8f6, { rim: 0.4 });
  if (geo) g.add(new THREE.Mesh(geo, mat));
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(LAMP).multiplyScalar(2.2), toneMapped: false });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lampMat);
  lamp.position.set(0.9, -1.75, 0);
  g.add(lamp);
  group.add(g);
  inkScenery(g);
  disposers.push(() => {
    mat.dispose();
    lampMat.dispose();
  });
  return g;
}

// ───────────────────────── Arena ─────────────────────────

/** The part shared by both modes: ground, Star Gate, guild and academy, houses and city gate around the plaza, the ring city */
function buildCommon(ctx: ArenaCtx, mode: Mode, flags: FlagSet): void {
  const { b, r, ground, disposers } = ctx;
  const tex = plazaTex(mode);
  const groundMat = new THREE.MeshLambertMaterial({ map: tex });
  ground.material = groundMat;
  disposers.push(() => {
    tex.dispose();
    groundMat.dispose();
  });
  buildGate(ctx);
  guildHall(b, flags, 25, -15, r);
  academyTower(b, -26, -13);
  cityGate(b, flags, 0, 36);
  // Houses around the plaza (avoiding the Star Gate side)
  const spots: [number, number][] = [[5, 30], [35, 32], [62, 31], [118, 31], [145, 33], [170, 30], [192, 31], [20, 38], [155, 39], [90, 42]];
  spots.forEach(([deg, d], i) => {
    const a = (deg / 180) * Math.PI;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    house(b, M(x, 0, z, faceCenter(x, z) + (r() - 0.5) * 0.3), 5 + r() * 3, 4.5 + r() * 2, 4 + r() * 2.2, [STONE_LIGHT, 0xe0d6ee, 0xd8ccec][i % 3], [ROOF, ROOF2, 0x7a5ac0, 0x8a4a80][i % 4], r, 2, 1, true);
  });
  // Street trees at the edge of the plaza; in arena mode the stands take that ring, and the trees move out beyond the stands
  for (const [deg, d] of [[20, 22], [58, 24], [122, 24], [160, 22], [200, 24], [340, 22]] as const) {
    const a = (deg / 180) * Math.PI;
    const dd = mode === 'arena' ? d + 6.5 : d;
    tree(b, Math.cos(a) * dd, Math.sin(a) * dd, 1 + r() * 0.3, TRUNK, LEAF, r);
  }
  ringCity(b, r);
}

/** Hub: market stalls, lamp posts and string lights, banners, airships, and sky lanterns drifting into the night sky */
function buildHub(ctx: ArenaCtx): void {
  const { group, b, r, extras, disposers } = ctx;
  const flags = new FlagSet();
  buildCommon(ctx, 'hub', flags);
  // Lamp posts on the plaza: a ring of 12, with the camera side (-x, +z) left empty
  const posts: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const x = Math.cos(a) * 10.2;
    const z = Math.sin(a) * 10.2;
    if (x < 3 && z > 3) continue;
    lampPost(b, x, z);
    posts.push([x, z]);
  }
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const q = posts[(i + 1) % posts.length];
    const gap = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (gap < 7) stringLights(b, p, q, 3.1);
  }
  // Market: stalls ring the outside of the plaza, with the stallkeepers' banners planted beside them
  const stalls: [number, number, number][] = [[0, 13.5, 0], [28, 14.5, 1], [-32, 14, 2], [180, 13.5, 3], [205, 14.5, 4], [155, 14, 5], [58, 15, 1], [235, 16.5, 0]];
  for (const [deg, d, ci] of stalls) {
    const a = (deg / 180) * Math.PI;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    stall(b, M(x, 0, z, faceCenter(x, z)), CLOTH[ci], r);
  }
  for (const [deg, d, ci] of [[14, 12.5, 5], [-16, 12.5, 3], [166, 12.5, 0], [196, 12.5, 2]] as const) {
    const a = (deg / 180) * Math.PI;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    b.add(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 5), IRON, M(x, 1.9, z));
    b.glow(new THREE.OctahedronGeometry(0.14), 0xffe680, M(x, 3.9, z));
    flags.add(1.3, 0.8, M(x, 3.4, z, faceCenter(x, z) + Math.PI / 2), CLOTH[ci], 'pole', deg * 0.1, 2);
  }
  // Piles of goods at the edge of the plaza
  for (const [x, z] of [[14.5, -4], [-15, 3.5], [13, 6.5]] as const) {
    b.add(new THREE.BoxGeometry(0.7, 0.7, 0.7), 0xa07a50, M(x, 0.35, z, r()));
    b.add(new THREE.BoxGeometry(0.6, 0.6, 0.6), 0xb08a5a, M(x + 0.5, 0.3, z + 0.6, r()));
    b.add(new THREE.CylinderGeometry(0.33, 0.3, 0.72, 8), WOOD_DARK, M(x - 0.6, 0.36, z + 0.4));
  }
  const flagMat = flags.build(group, disposers);
  const airship = buildAirship(group, disposers);
  let lanternT = 0;
  extras.push((dt, t, vfx) => {
    if (flagMat) flagMat.uniforms.uTime.value = t;
    const a = t * 0.045;
    airship.position.set(Math.cos(a) * 60, 26 + Math.sin(t * 0.3) * 0.8, Math.sin(a) * 60 - 6);
    airship.rotation.y = -(a + Math.PI / 2);
    // Sky lanterns: warm points of light rising slowly into the distance
    lanternT += dt;
    while (lanternT > 1.1) {
      lanternT -= 1.1;
      const la = Math.random() * Math.PI * 2;
      const d = 28 + Math.random() * 40;
      vfx.emit({ pos: new THREE.Vector3(Math.cos(la) * d, 3 + Math.random() * 4, Math.sin(la) * d), count: 1, color: [0xffb060, 0xffd890], speed: [0.35, 0.7], dir: new THREE.Vector3(0.1, 1, 0), spread: 0.15, life: [14, 20], size: [0.4, 0.65], sizeEnd: 0.8, drag: 0, intensity: 1.8 });
    }
  });
}

/** Arena: stands, spectators, spotlights, a sea of banners and fireworks */
function buildArenaMode(ctx: ArenaCtx): void {
  const { group, extras } = ctx;
  const flags = new FlagSet();
  buildCommon(ctx, 'arena', flags);
  const stands = buildStands(ctx, flags);
  const spots = buildSpotlights(ctx);
  const flagMat = flags.build(group, ctx.disposers);
  let fwT = 0.6;
  const target = new THREE.Vector3();
  extras.push((dt, t, vfx) => {
    if (flagMat) flagMat.uniforms.uTime.value = t;
    stands.update(t);
    // The beams sweep low across the whole arena and land at the foot of the opposite stands (the camera is very low, and beams that are too high would leave the frame)
    spots.pivots.forEach((p, i) => {
      const ph = i * 1.7;
      const a = Math.atan2(p.position.z, p.position.x) + Math.PI + Math.sin(t * 0.4 + ph) * 0.9;
      const d = 13 + Math.sin(t * 0.27 + ph * 1.3) * 3;
      target.set(Math.cos(a) * d, 2.5 + Math.sin(t * 0.33 + ph) * 2, Math.sin(a) * d);
      p.lookAt(target);
    });
    // Fireworks: bursting at irregular times in the distant night sky
    fwT -= dt;
    if (fwT <= 0) {
      fwT = 1.6 + Math.random() * 2.2;
      const a = Math.random() * Math.PI * 2;
      const d = 42 + Math.random() * 30;
      const col = GEMS[Math.floor(Math.random() * 8)];
      const at = new THREE.Vector3(Math.cos(a) * d, 24 + Math.random() * 14, Math.sin(a) * d);
      vfx.emit({ pos: at, count: 70, color: [col, 0xffffff], speed: [4, 8], life: [1, 1.8], size: [0.25, 0.5], gravity: 2.5, drag: 1.3, atlas: 1, intensity: 2.4 });
      void vfx.ring(at, col, 0.3, 6, 0.6, at.clone().negate().setY(0));
    }
  });
}

const HUB_PALETTE: Palette = {
  sky: ['#1b1f4a', '#5a4a9a', '#e8a8c8'],
  fog: 0x7a68a8,
  fogNear: 24,
  fogFar: 120,
  ground: ['#cfc6e0', '#a89cc8', '#ffe9a8'],
  light: [0.4, 0.85, 0.35],
  ambient: 0x8a82b8,
  rim: 0xffd8f0,
  shadow: 0x7a5ab0,
  motes: [0xfff0a0, 0xa0d8ff],
  moteKind: 'float',
  stars: true,
};

const ARENA_PALETTE: Palette = {
  sky: ['#0a0a2e', '#2c1c60', '#c0507a'],
  fog: 0x4a3878,
  fogNear: 24,
  fogFar: 120,
  ground: ['#b8b0d0', '#8a80b0', '#ffd87a'],
  light: [0.35, 0.9, 0.3],
  ambient: 0x7a72a8,
  rim: 0xffc8e8,
  shadow: 0x5a3a90,
  motes: [0xffd870, 0xff8ad0, 0x8ad8ff],
  moteKind: 'fall',
  moteAtlas: [3, 0.6],
  stars: true,
};

export const hub: RegionModule = { palette: HUB_PALETTE, build: buildHub };
export const arena: RegionModule = { palette: ARENA_PALETTE, build: buildArenaMode };
