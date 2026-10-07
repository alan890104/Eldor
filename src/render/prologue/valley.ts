// Set for the prologue's "lost world": a village and windmill on the hills, clumps of trees (some in pink bloom), small flowers on the ground, and a flock of birds crossing the sky.
// Shown only in the third segment (23 to 40 s). All the static things are merged by color with PropBatch, leaving only a dozen or so meshes.

import * as THREE from 'three';
import { M, PropBatch, rng } from '../arenaKit.ts';
import { sceneMaterial } from '../spiritToon.ts';
import { inkScenery } from '../ink.ts';
import { heightAt } from './sets.ts';

export interface Valley {
  group: THREE.Group;
  /** Windmill blades (rotating about z) */
  blades: THREE.Object3D;
  /** Chimney mouth (for cooking smoke) */
  chimneys: THREE.Vector3[];
  birds: Bird[];
  birdGroup: THREE.Group;
}

export interface Bird {
  g: THREE.Group;
  wings: THREE.Object3D[];
  phase: number;
  /** Position in the formation */
  slot: THREE.Vector3;
}

/** Center of the village: the background of the child's scene, and the distant hill in the early-morning shot */
export const VILLAGE = new THREE.Vector3(20, 0, -54);
export const WINDMILL = new THREE.Vector3(27.5, 0, -50);

/** Places where nothing may be put: where the spirits are born, the child and `cloudfluff`, and in front of the two cameras */
const CLEAR: [number, number, number][] = [
  [-7.5, -33.5, 4.5],
  [-7, -28, 3.5],
  [4.6, -30, 4.5],
  [4.6, -25, 3.5],
  [4.6, -21, 3],
];
const clear = (x: number, z: number, pad = 0) => CLEAR.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r + pad);

const TRUNK = 0x7a553a;
const LEAVES = [0x4f9a4c, 0x68b457, 0x3f8446];
const LEAVES_WARM = [0x8ab44a, 0x9cc45a, 0x6fa048];
const BLOSSOM = [0xf4a8c8, 0xffc4dc, 0xe888b0];
const FLOWERS = [0xff8fb8, 0xfff2f8, 0xffd84a, 0xc8a0ff, 0xff9a6a, 0x9ad8ff];

/** Round-crowned tree (sits on the terrain height y) */
function treeAt(b: PropBatch, x: number, y: number, z: number, s: number, leaves: number[], r: () => number): void {
  b.add(new THREE.CylinderGeometry(0.25, 0.4, 3, 7), TRUNK, M(x, y + 1.5 * s, z, 0, s));
  for (let i = 0; i < 3; i++) {
    const ry = r() * 6;
    b.add(new THREE.IcosahedronGeometry(1.4 - i * 0.25, 1), leaves[i % leaves.length], M(x + Math.cos(ry) * 0.4 * s, y + (3 + i * 0.9) * s, z + Math.sin(ry) * 0.4 * s, ry, s));
  }
}

/** Pointed pine */
function pineAt(b: PropBatch, x: number, y: number, z: number, s: number): void {
  b.add(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 6), TRUNK, M(x, y + 0.6 * s, z, 0, s));
  for (let i = 0; i < 3; i++) b.add(new THREE.ConeGeometry(1.5 - i * 0.35, 1.8, 8), 0x3a7a4a, M(x, y + (1.6 + i * 1.0) * s, z, i, s));
}

function cottage(b: PropBatch, x: number, z: number, ry: number, s: number, wall: number, roof: number): THREE.Vector3 {
  const y = heightAt(x, z) - 0.2;
  const c = Math.cos(ry);
  const sn = Math.sin(ry);
  const at = (lx: number, ly: number, lz: number, sc = 1) => M(x + c * lx + sn * lz, y + ly, z - sn * lx + c * lz, ry, sc);
  const w = 2.4 * s;
  const d = 2.0 * s;
  const h = 1.7 * s;
  b.add(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), 0x9a8a78, at(0, 0.2, 0));
  b.add(new THREE.BoxGeometry(w, h, d), wall, at(0, 0.4 + h / 2, 0));
  const roofH = d * 0.62;
  const prism = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  prism.rotateX(Math.PI / 2);
  prism.rotateZ(Math.PI);
  prism.rotateY(Math.PI / 2);
  prism.scale(w + 0.5, roofH / 1.5, (d * 0.64) / 0.866);
  b.add(prism, roof, at(0, 0.4 + h + roofH / 3, 0));
  b.add(new THREE.BoxGeometry(0.4, 1.0 * s, 0.4), 0x8a6a5a, at(w * 0.28, 0.4 + h + roofH * 0.55, -d * 0.15));
  b.add(new THREE.BoxGeometry(0.7 * s, 1.1 * s, 0.1), 0x6a4a34, at(0, 0.4 + 0.55 * s, d / 2 + 0.02), false);
  for (const sx of [-1, 1]) b.glow(new THREE.BoxGeometry(0.46 * s, 0.4 * s, 0.08), 0x7a5a2a, at(sx * w * 0.3, 0.4 + h * 0.6, d / 2 + 0.03));
  return new THREE.Vector3(x + c * w * 0.28 + sn * -d * 0.15, y + 0.4 + h + roofH * 0.55 + 0.6 * s, z - sn * w * 0.28 + c * -d * 0.15);
}

export function buildValley(low: boolean): Valley {
  const group = new THREE.Group();
  const b = new PropBatch();
  const r = rng(907);
  const chimneys: THREE.Vector3[] = [];

  // Village: a ring of small houses on the hill, with alternating red and blue roofs
  const walls = [0xf2e6d0, 0xe8d8bc, 0xf6eee0];
  const roofs = [0xc85a4a, 0x4a6ab8, 0xd88a3a, 0x7a5aa8];
  const houses: [number, number, number, number][] = [
    [-5, 2, 0.4, 1.0],
    [-1, -3, 0.1, 1.15],
    [3.5, 1, -0.3, 0.95],
    [0.5, 4.5, 0.6, 0.9],
    [-7, -3.5, 0.9, 0.85],
    [6.5, -3, -0.6, 1.0],
    [-3, 7.5, 0.2, 0.8],
    [8, 5, -0.9, 0.85],
  ];
  const houseSpots: THREE.Vector2[] = [];
  houses.slice(0, low ? 6 : houses.length).forEach(([dx, dz, ry, s], i) => {
    const x = VILLAGE.x + dx;
    const z = VILLAGE.z + dz;
    houseSpots.push(new THREE.Vector2(x, z));
    chimneys.push(cottage(b, x, z, ry, s, walls[i % walls.length], roofs[i % roofs.length]));
  });
  // Stone tower in the middle of the village: a pointed roof with a flag on top
  {
    const x = VILLAGE.x + 1.5;
    const z = VILLAGE.z - 8;
    const y = heightAt(x, z);
    b.add(new THREE.CylinderGeometry(1.1, 1.3, 7, 10), 0xe0d6c4, M(x, y + 3.5, z));
    b.add(new THREE.ConeGeometry(1.5, 2.6, 10), 0x4a6ab8, M(x, y + 8.3, z));
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), 0x6a5a4a, M(x, y + 10.2, z), false);
    b.add(new THREE.BoxGeometry(0.05, 0.6, 1.0), 0xffd84a, M(x, y + 10.6, z + 0.5), false);
    houseSpots.push(new THREE.Vector2(x, z));
  }
  // Windmill: the tower body merges into the batch, and the blades are made separately as a rotating mesh
  const wy = heightAt(WINDMILL.x, WINDMILL.z);
  b.add(new THREE.CylinderGeometry(0.9, 1.4, 6, 10), 0xf0e4cc, M(WINDMILL.x, wy + 3, WINDMILL.z));
  b.add(new THREE.ConeGeometry(1.3, 1.6, 10), 0xc85a4a, M(WINDMILL.x, wy + 6.8, WINDMILL.z));
  houseSpots.push(new THREE.Vector2(WINDMILL.x, WINDMILL.z));
  const blades = new THREE.Group();
  blades.position.set(WINDMILL.x, wy + 5.8, WINDMILL.z + 1.35);
  blades.rotation.y = 0.35;
  const hub = new THREE.Group();
  blades.add(hub);
  {
    const wood = sceneMaterial(0x8a6a4a, { rim: 0.35 });
    const sail = sceneMaterial(0xfff6e6, { rim: 0.4 });
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.2, 0.12), wood);
      beam.position.y = 2.1;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.2, 0.05), sail);
      cloth.position.set(0.5, 2.5, 0);
      arm.add(beam, cloth);
      hub.add(arm);
    }
  }
  inkScenery(blades);
  group.add(blades);

  // Trees: two groves left and right, a row in the distance, a few around the village; a quarter bloom in pink
  const nearHouse = (x: number, z: number) => houseSpots.some((h) => Math.hypot(h.x - x, h.y - z) < 3.4);
  const plant = (x: number, z: number, s: number) => {
    if (!clear(x, z, 1.5) || nearHouse(x, z)) return;
    const y = heightAt(x, z) - 0.15;
    const k = r();
    if (k < 0.22) pineAt(b, x, y, z, s);
    else if (k < 0.47) treeAt(b, x, y, z, s, BLOSSOM, r);
    else treeAt(b, x, y, z, s, r() < 0.5 ? LEAVES : LEAVES_WARM, r);
  };
  const n = low ? 60 : 110;
  for (let i = 0; i < n; i++) {
    const zone = r();
    let x: number;
    let z: number;
    if (zone < 0.32) {
      x = -44 + r() * 30;
      z = -64 + r() * 60;
    } else if (zone < 0.58) {
      x = 14 + r() * 30;
      z = -38 + r() * 42;
    } else if (zone < 0.86) {
      x = -30 + r() * 70;
      z = -80 + r() * 18;
    } else {
      x = VILLAGE.x - 12 + r() * 24;
      z = VILLAGE.z - 10 + r() * 16;
    }
    plant(x, z, 0.75 + r() * 0.7);
  }
  // Foreground at the start of the early-morning shot: two big trees
  plant(-13.5, 7.5, 1.5);
  plant(-19, 1, 1.3);
  plant(-4.5, 9, 1.2);
  // Trees where the spirits are born and behind the child (farther away, as background)
  for (const [x, z, s] of [
    [-12.5, -41, 1.3],
    [-3, -43, 1.1],
    [-15, -36, 1.0],
    [-1.5, -37, 1.2],
    [11.5, -34, 1.2],
    [13, -30, 1.0],
  ] as const)
    plant(x, z, s);

  // Small flowers: clumps hugging the ground
  const petal = new THREE.IcosahedronGeometry(0.09, 1);
  const leaf = new THREE.ConeGeometry(0.1, 0.35, 4);
  const patch = (cx: number, cz: number, spread: number, count: number) => {
    const col = FLOWERS[Math.floor(r() * FLOWERS.length)];
    for (let i = 0; i < count; i++) {
      const x = cx + (r() - 0.5) * spread;
      const z = cz + (r() - 0.5) * spread;
      const y = heightAt(x, z);
      b.add(leaf, 0x4a9a4a, M(x, y + 0.12, z, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), false);
      b.add(petal, r() < 0.8 ? col : FLOWERS[Math.floor(r() * FLOWERS.length)], M(x, y + 0.28 + r() * 0.1, z, r() * 6, 0.7 + r() * 0.45), false);
    }
  };
  const spots: [number, number, number, number][] = [
    // Foreground of the early-morning shot
    [-10, -1, 3, 14],
    [-7.5, -3.5, 3, 12],
    [-13.5, -5, 3, 12],
    [-9.5, -8.5, 4, 14],
    // The riverside where the spirits are born
    [-10.5, -32, 2.5, 10],
    [-4.5, -35.5, 2.5, 9],
    [-9, -37, 3, 10],
    [-5.5, -31, 2, 7],
    // Around the feet of and behind the child and `cloudfluff`
    [1.5, -32, 2.5, 8],
    [7.8, -32.5, 2.5, 8],
    [4, -35, 3, 10],
  ];
  for (const [x, z, sp, c] of spots) patch(x, z, sp, low ? Math.ceil(c * 0.6) : c);
  for (let i = 0; i < (low ? 30 : 70); i++) {
    const x = -40 + r() * 70;
    const z = -60 + r() * 66;
    if (clear(x, z, 0.5) && !nearHouse(x, z)) patch(x, z, 2.5, 6);
  }
  b.build(group);

  // Flock of birds: dark silhouettes against the light
  const birdGroup = new THREE.Group();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x2a2436 });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.18, 0, 0, 0.14, 0.95, 0.05, -0.12], 3));
  wingGeo.computeVertexNormals();
  const bodyGeo = new THREE.SphereGeometry(0.16, 6, 4);
  bodyGeo.scale(0.8, 0.7, 2.0);
  const birds: Bird[] = [];
  const nb = low ? 7 : 11;
  for (let i = 0; i < nb; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, birdMat));
    const wings: THREE.Object3D[] = [];
    for (const sx of [1, -1]) {
      const w = new THREE.Mesh(wingGeo, birdMat);
      w.scale.x = sx;
      (w.material as THREE.Material).side = THREE.DoubleSide;
      g.add(w);
      wings.push(w);
    }
    // A V-shaped formation, with the ones at the back slightly more scattered
    const row = Math.ceil(i / 2);
    const side = i === 0 ? 0 : i % 2 ? 1 : -1;
    const slot = new THREE.Vector3(side * row * 1.6 + (r() - 0.5) * 0.6, (r() - 0.5) * 0.8, row * 1.5 + (r() - 0.5) * 0.5);
    g.scale.setScalar(1.3);
    birdGroup.add(g);
    birds.push({ g, wings, phase: r() * 6.28, slot });
  }
  group.add(birdGroup);

  group.visible = false;
  return { group, blades: hub, chimneys, birds, birdGroup };
}
