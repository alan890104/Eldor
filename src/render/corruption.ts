// Corrupted form: a spirit infected by the Void Blight, told apart from its normal look at a glance:
// the body fades to purple-black, its surface is covered with pulsing glowing cracks (the toon shader's uCorrupt), black-purple void crystals grow from the back,
// the eyes become hollow, red-glowing sockets, black Void mist seeps out around the feet, and it twitches from time to time.

import * as THREE from 'three';
import type { Creature } from './creature.ts';
import { INK_LAYER } from './ink.ts';
import { spiritMaterial } from './spiritToon.ts';
import { toonMaterial } from './toon.ts';

const VOID = 0x1a0a26;
const GLOW = new THREE.Color(1.9, 0.18, 1.1);
const EYE = new THREE.Color(2.8, 0.06, 0.18);

let poolTex: THREE.Texture | null = null;
function voidPoolTex(): THREE.Texture {
  if (poolTex) return poolTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(20,4,30,0.85)');
  rg.addColorStop(0.55, 'rgba(60,8,80,0.55)');
  rg.addColorStop(0.8, 'rgba(200,40,170,0.35)');
  rg.addColorStop(1, 'rgba(120,20,140,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  // Several cracks splitting outward
  g.strokeStyle = 'rgba(255,80,210,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    let a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
    let r = 18;
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    while (r < 58) {
      r += 6 + Math.random() * 6;
      a += (Math.random() - 0.5) * 0.5;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.stroke();
  }
  poolTex = new THREE.CanvasTexture(cv);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

/** Turn a freshly built spirit (size not yet normalized) into its corrupted form */
export function applyCorruption(c: Creature): void {
  c.corrupt = true;
  // Body and outline
  for (const m of c.mats) m.uniforms.uCorrupt.value = 1;
  for (const m of c.outlines) (m.uniforms.uColor.value as THREE.Color).set(0x2a0636);
  // Parts that used to glow (flames, halos, gems) turn purple-red
  for (const m of c.glows) m.color.lerp(GLOW, 0.75);

  // Parts added by a post-process outline spirit (lab model) also use the spirit material and enable the outline layer, with the same shading and lines as the body
  const mat = c.ink ? spiritMaterial : toonMaterial;

  // Eyes: the whites turn black, the pupils become hollow red-glowing sockets, and the eye highlights go out
  const sclera = mat(0x14061c, { rim: 0.2 });
  const eyeGlow = new THREE.MeshBasicMaterial({ color: EYE.clone(), toneMapped: false });
  c.mats.push(sclera);
  c.glows.push(eyeGlow);
  // The new models' eyes are empty anchors on the eyeball surface: if the anchor's parent group is small enough (it is just that eye), swap its material; if the parent is the whole head, place a red glow at the anchor
  c.root.updateMatrixWorld(true);
  const bodyBox = new THREE.Box3().setFromObject(c.scaler);
  const bodyH = bodyBox.max.y - bodyBox.min.y;
  const eyeRoots: THREE.Object3D[] = [];
  for (const eye of c.eyes) {
    if (!c.lab) {
      eyeRoots.push(eye);
      continue;
    }
    const p = eye.parent;
    const pb = p ? new THREE.Box3().setFromObject(p) : null;
    if (p && pb && !pb.isEmpty() && pb.getSize(new THREE.Vector3()).length() < bodyH * 0.14) eyeRoots.push(p);
    else {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), eyeGlow);
      const ws = new THREE.Vector3();
      eye.getWorldScale(ws);
      dot.scale.set(1 / ws.x, 1 / ws.y, (1 / ws.z) * 0.5).multiplyScalar(bodyH * 0.022);
      eye.add(dot);
    }
  }
  // New models with no face (jellyfish, cloud, flower, object): the "eyes turn red" beat is taken over by the anchor of the glowing core or signature object, with a red glow placed there
  if (c.lab && !c.eyes.length) {
    const at = ['glow', 'core', 'lamp', 'flower', 'crest', 'seal'].map((k) => c.anchor(k)).find((a) => a) ?? c.head;
    if (at) {
      // If the anchor already has a small glowing part (the cloud's warm light, the jellyfish's lamp), swap it for the red glow directly; otherwise add a separate one
      const ap = at.getWorldPosition(new THREE.Vector3());
      // Find the smallest part that encloses the anchor (no more than 30% of the height, so the whole body is not swapped)
      let best: THREE.Mesh | null = null;
      let bestSize = bodyH * 0.3;
      (at.parent ?? at).traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mb = new THREE.Box3().setFromObject(mesh);
        const sz = mb.getSize(new THREE.Vector3()).length();
        if (sz < bestSize && mb.distanceToPoint(ap) < bodyH * 0.02) {
          best = mesh;
          bestSize = sz;
        }
      });
      const swapped = !!best;
      if (best) (best as THREE.Mesh).material = eyeGlow;
      if (!swapped) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), eyeGlow);
        const ws = new THREE.Vector3();
        at.getWorldScale(ws);
        dot.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z).multiplyScalar(bodyH * 0.04);
        at.add(dot);
      }
    }
  }
  for (const eye of eyeRoots) {
    eye.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.ShaderMaterial | THREE.MeshBasicMaterial;
      if ((mat as THREE.ShaderMaterial).uniforms?.uThickness) return;
      if ((mat as THREE.ShaderMaterial).uniforms?.uColor && !(mat as THREE.ShaderMaterial).uniforms.uThickness) {
        const col = (mat as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color;
        const lum = col.r + col.g + col.b;
        mesh.material = lum > 2.7 ? sclera : eyeGlow;
      } else if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        // The original highlight: shrink it to a tiny red dot
        mesh.material = eyeGlow;
        mesh.scale.multiplyScalar(0.5);
      }
    });
  }

  // Void crystals: black-purple crystals growing outward from the back and the top of the head
  c.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(c.scaler);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const H = Math.max(size.x, size.y, size.z);
  // Crystal size: old models use the longest edge; new models use the height (a wide body sized by its longest edge would grow crystal clusters taller than the body), and one size smaller
  const crystalH = c.lab ? Math.min(H, size.y) * 0.7 : H;
  const targets: THREE.Mesh[] = [];
  c.body.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.material as THREE.ShaderMaterial | undefined;
    if (m.isMesh && mat?.uniforms?.uCorrupt) targets.push(m);
  });
  const crystal = mat(VOID, { rim: 0.9, emissive: 0x6a0a5a, emissiveAmt: 0.35 });
  const core = new THREE.MeshBasicMaterial({ color: GLOW.clone(), toneMapped: false, transparent: true, opacity: 0.9 });
  c.mats.push(crystal);
  c.glows.push(core);
  const ray = new THREE.Raycaster();
  const dirs: [number, number][] = [[0, 1.25], [-0.9, 0.7], [0.9, 0.7], [Math.PI - 0.5, 0.45], [Math.PI + 0.5, 0.45], [Math.PI, 0.9]];
  let placed = 0;
  // New models often leave the face exposed (round face, floating head): clusters landing near the eyes would grow over the face, so skip them
  const eyeAt = c.lab && c.eyes.length ? c.eyes.reduce((v, e) => v.add(e.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).divideScalar(c.eyes.length) : null;
  const faceR = size.y * 0.3;
  for (const [az, el] of dirs) {
    if (placed >= 5) break;
    // Azimuth 0 is behind (-z)
    const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    ray.set(center.clone().addScaledVector(d, H * 3), d.clone().negate());
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit || !hit.face) continue;
    if (eyeAt && hit.point.distanceTo(eyeAt) < faceR) continue;
    const parent = hit.object.parent ?? c.body;
    const local = parent.worldToLocal(hit.point.clone());
    const nWorld = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const pq = new THREE.Quaternion();
    parent.getWorldQuaternion(pq);
    const nLocal = nWorld.applyQuaternion(pq.invert()).normalize();
    const cluster = new THREE.Group();
    cluster.position.copy(local);
    cluster.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nLocal.lerp(new THREE.Vector3(0, 1, 0), 0.35).normalize());
    // Compensate for the parent's scale so the crystal is not squashed
    const ps = new THREE.Vector3();
    parent.getWorldScale(ps);
    cluster.scale.set(1 / ps.x, 1 / ps.y, 1 / ps.z);
    const s = crystalH * (placed === 0 ? 0.16 : 0.11);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.OctahedronGeometry(1, 0);
      const len = s * (i === 0 ? 2.4 : 1.4 + Math.random() * 0.5);
      g.scale(s * 0.42, len, s * 0.42);
      g.translate(0, len * 0.55, 0);
      const shard = new THREE.Mesh(g, crystal);
      if (c.ink) shard.layers.enable(INK_LAYER);
      shard.rotation.set((i - 1) * 0.55 + (Math.random() - 0.5) * 0.2, Math.random() * 6, (Math.random() - 0.5) * 0.5);
      const inner = new THREE.Mesh(g.clone().scale(0.45, 0.8, 0.45), core);
      shard.add(inner);
      cluster.add(shard);
    }
    parent.add(cluster);
    placed++;
  }

  // The Void's black pool under the feet and the black mist rising from it (attached to root: sizes use the normalized world size)
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: voidPoolTex(), transparent: true, depthWrite: false, toneMapped: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.04;
  const poolSize = Math.max(size.x, size.z) * 1.7 + 0.5;
  pool.scale.setScalar(poolSize);
  pool.renderOrder = 1;
  c.root.add(pool);
  const smokeTex = smokeTexture();
  const dark = new THREE.SpriteMaterial({ map: smokeTex, color: 0x1e0428, transparent: true, depthWrite: false, opacity: 0.85 });
  const glow = new THREE.SpriteMaterial({ map: smokeTex, color: new THREE.Color(1.1, 0.04, 0.65), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.4 });
  const R = Math.max(size.x, size.z) * 0.45;
  const puffs: { s: THREE.Sprite; phase: number; a: number; speed: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(i % 3 === 0 ? glow : dark);
    c.root.add(sp);
    puffs.push({ s: sp, phase: i / 9, a: (i / 9) * Math.PI * 2, speed: 0.35 + Math.random() * 0.2 });
  }
  const top = size.y;
  c.tickHooks.push((_dt, t) => {
    for (const p of puffs) {
      const k = (t * p.speed + p.phase) % 1;
      const a = p.a + t * 0.4;
      const r = R * (0.8 + k * 0.5);
      p.s.position.set(center.x + Math.cos(a) * r, 0.1 + k * top * 0.9, center.z + Math.sin(a) * r);
      const sc = (0.25 + k * 0.55) * Math.max(0.6, H * 0.45);
      p.s.scale.set(sc, sc, 1);
      p.s.material.rotation = a;
    }
    dark.opacity = 0.8 * fade;
    glow.opacity = 0.35 * fade;
    pool.scale.setScalar(poolSize * (0.92 + Math.sin(t * 2.2) * 0.08));
    core.opacity = (0.65 + Math.sin(t * 3) * 0.25) * fade;
  });
  let fade = 1;
  c.fadeHooks.push((o) => {
    fade = o;
    (pool.material as THREE.MeshBasicMaterial).opacity = o;
  });
}

let smokeTex: THREE.Texture | null = null;
function smokeTexture(): THREE.Texture {
  if (smokeTex) return smokeTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  // Several soft circles stacked together, with slightly irregular edges so it reads as smoke
  for (let i = 0; i < 6; i++) {
    const x = 32 + (Math.random() - 0.5) * 16;
    const y = 32 + (Math.random() - 0.5) * 16;
    const r = 14 + Math.random() * 10;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.5)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
  }
  smokeTex = new THREE.CanvasTexture(cv);
  return smokeTex;
}
