// Far view beyond the map: the basalt highland that joins the outside of the cliff walls (covering the lava surface beyond
// the map), the erupting Emberspine Peak to the northwest, the magma running down its flanks from the crater (one flow turns
// into the lavafall on the northwest cliff wall, which is the source of the lava river), and the crater's smoke plume and
// ejected rocks.

import * as THREE from 'three';
import { M, PropBatch } from '../../../arenaKit.ts';
import { smooth } from '../../compose.ts';
import type { FieldCtx } from '../../kit.ts';
import { lavaMaterial, plumeMaterial, ribbon, skyMaterial } from './fx.ts';
import { FOG, LAVA, S, VOLC, VOLC_H, VOLC_RIM, riverHalfWidth, riverSamples, volcanoH } from './shape.ts';

const FAR = 330;

/** Other distant mountains (off the map) */
const PEAKS: [number, number, number, number][] = [
  [175, -170, 62, 70],
  [230, -40, 40, 60],
  [-230, 30, 48, 70],
  [-190, 190, 38, 60],
  [120, 230, 34, 55],
  [-40, 250, 30, 55],
  [250, 150, 36, 60],
];

/** Magma flow on the flank: runs down from the crater rim and fades out after the last point */
interface Flow {
  pts: THREE.Vector3[];
  width: (t: number) => number;
}

export interface FarOut {
  crater: THREE.Vector3;
  /** Index of the river sample point where lava starts inside the map */
  riverStart: number;
}

function wander(a: [number, number], b: [number, number], n: number, amp: number, seed: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l = Math.hypot(dx, dz);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const k = Math.sin(t * Math.PI) * amp * (Math.sin(t * 9 + seed) * 0.6 + Math.sin(t * 23 + seed * 2) * 0.4);
    out.push([a[0] + dx * t - (dz / l) * k, a[1] + dz * t + (dx / l) * k]);
  }
  return out;
}

export function buildFar(ctx: FieldCtx): { out: FarOut; update: (dt: number, t: number, vfx: import('../../../vfx.ts').Vfx) => void } {
  const edgeH = (x: number, z: number) => ctx.h(Math.max(-S, Math.min(S, x)), Math.max(-S, Math.min(S, z)));
  const { pts: rPts } = riverSamples();

  // ── Magma flow paths (decided first, since the far highland is carved with grooves along them)
  const rim = (toward: [number, number], k = 1): [number, number] => {
    const a = Math.atan2(toward[1] - VOLC[1], toward[0] - VOLC[0]);
    return [VOLC[0] + Math.cos(a) * VOLC_RIM * k, VOLC[1] + Math.sin(a) * VOLC_RIM * k];
  };
  const src = rPts[0];
  const flowsXZ: [number, number][][] = [
    // flows southeast to the top of the northwest cliff wall, joining the source of the lava river
    wander(rim([src[0], src[1]], 0.85), [src[0] - 4, src[1] - 9], 42, 7, 1.3),
    // flows south and cools at the foot of the mountain
    wander(rim([-40, -120], 0.85), [-48, -128], 34, 9, 4.1),
    // southwest
    wander(rim([-150, -150], 0.85), [-146, -142], 30, 8, 2.2),
  ];
  const grooves = flowsXZ.map((f) => f.filter((_, i) => i % 2 === 0));
  // bounding box of the grooves: points outside it are simply treated as very far (the far highland has many vertices, and
  // computing the distance segment by segment takes a long time)
  const gb = grooves.map((g) => {
    const xs = g.map((p) => p[0]);
    const zs = g.map((p) => p[1]);
    return [Math.min(...xs) - 8, Math.max(...xs) + 8, Math.min(...zs) - 8, Math.max(...zs) + 8];
  });
  const grooveD = (x: number, z: number) => {
    let best = 99;
    for (let gi = 0; gi < grooves.length; gi++) {
      const bb = gb[gi];
      if (x < bb[0] || x > bb[1] || z < bb[2] || z > bb[3]) continue;
      const g = grooves[gi];
      for (let i = 0; i < g.length - 1; i++) {
        const [ax, az] = g[i];
        const [bx, bz] = g[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
      }
    }
    return best;
  };

  const farH = (x: number, z: number) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    let h = 20 + 6 * Math.sin(x * 0.021 + 1) * Math.cos(z * 0.017) + 4 * Math.sin(x * 0.05 - z * 0.04) + 2 * Math.sin(x * 0.13 + z * 0.11);
    h += 0.2 * Math.max(0, m - S);
    // jagged ridgelines: the farther from the map, the taller
    const ridge = (v: number) => 1 - Math.abs(Math.sin(v));
    const out = smooth(S + 8, S + 70, m);
    h += 16 * ridge(x * 0.029 + Math.sin(z * 0.021) * 1.6) * ridge(z * 0.025 - Math.cos(x * 0.018) * 1.4) * out;
    h += 7 * ridge(x * 0.071 - z * 0.052 + 0.7) * out + 3 * Math.sin(x * 0.17 + z * 0.13) * smooth(S, S + 25, m);
    h += volcanoH(x, z);
    for (const [px, pz, ph, pr] of PEAKS) {
      const d = Math.hypot(x - px, z - pz);
      h += ph * Math.pow(Math.max(0, 1 - d / pr), 1.6);
    }
    return h;
  };
  const skirtH = (x: number, z: number) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    const w = smooth(S, S + 34, m);
    let h = edgeH(x, z) * (1 - w) + farH(x, z) * w;
    // carve grooves along the magma flows (not on the map boundary, so that they still join up)
    const gd = grooveD(x, z);
    if (gd < 5) h -= 1.4 * (1 - smooth(1.5, 5, gd)) * smooth(S, S + 6, m);
    // inside the map (the part covered by the terrain) push it down a little to avoid clashing with the terrain
    if (m < S) h -= 1.2;
    return h;
  };

  // ── Far highland: non-uniform grid (denser near the map and around the main peak)
  const axis = (band?: [number, number]) => {
    const v: number[] = [];
    let x = -FAR;
    while (x < FAR) {
      v.push(x);
      const fine = (Math.abs(x) < S + 45) || (band && x >= band[0] && x < band[1]);
      x += fine ? 3 : 9;
    }
    v.push(FAR);
    return v;
  };
  const xs = axis([VOLC[0] - 40, VOLC[0] + 40]);
  const zs = axis([VOLC[1] - 40, VOLC[1] + 40]);
  const nx = xs.length;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const vid = new Int32Array(nx * zs.length).fill(-1);
  const cBase = new THREE.Color(0x2e262b);
  const cAsh = new THREE.Color(0x544649);
  const cDark = new THREE.Color(0x1c171b);
  const cHot = new THREE.Color(0x5a2420);
  const cRust = new THREE.Color(0x4a2e28);
  const c = new THREE.Color();
  const vert = (i: number, j: number) => {
    const k = j * nx + i;
    if (vid[k] >= 0) return vid[k];
    const x = xs[i];
    const z = zs[j];
    const h = skirtH(x, z);
    pos.push(x, h, z);
    // colors: darker toward the top, greyer on gentle slopes; the upper half of the main peak is dark red; scorched red
    // beside the magma grooves
    const vr = Math.hypot(x - VOLC[0], z - VOLC[1]);
    const slope = Math.hypot(skirtH(x + 1.5, z) - h, skirtH(x, z + 1.5) - h) / 1.5;
    c.copy(cBase).lerp(cAsh, smooth(0.1, 0.9, Math.sin(x * 0.04 + Math.cos(z * 0.03) * 2) * 0.5 + 0.5) * (1 - smooth(0.3, 0.8, slope)));
    c.lerp(cRust, smooth(0.5, 0.9, Math.sin(x * 0.013 - z * 0.017 + 2)) * 0.6);
    c.lerp(cDark, Math.max(smooth(40, 110, h) * 0.6, smooth(0.5, 1.2, slope) * 0.7));
    c.lerp(cHot, (1 - smooth(20, 70, vr)) * 0.5 + (1 - smooth(1, 6, grooveD(x, z))) * 0.6);
    col.push(c.r, c.g, c.b);
    vid[k] = pos.length / 3 - 1;
    return vid[k];
  };
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const z0 = zs[j];
      const z1 = zs[j + 1];
      // skip a cell that lies entirely inside the map (3 m or more from the boundary)
      const inside = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z)) < S - 3;
      if (inside(x0, z0) && inside(x1, z0) && inside(x0, z1) && inside(x1, z1)) continue;
      const a = vert(i, j);
      const b = vert(i + 1, j);
      const cc = vert(i, j + 1);
      const d = vert(i + 1, j + 1);
      idx.push(a, cc, b, b, cc, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const skirt = new THREE.Mesh(geo, ctx.terrain.mesh.material);
  ctx.group.add(skirt);
  ctx.disposers.push(() => geo.dispose());

  // ── Magma flows (mountain flank) and the lavafall (northwest cliff wall)
  const surf = (x: number, z: number) => (Math.max(Math.abs(x), Math.abs(z)) < S ? ctx.h(x, z) : skirtH(x, z));
  const flows: Flow[] = flowsXZ.map((f, fi) => ({
    pts: f.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    width: fi === 0 ? (t: number) => 1.6 + t * 1.2 : (t: number) => (1.4 + t * 0.6) * (1 - smooth(0.82, 1, t)),
  }));
  // the dry stretch of river channel inside the map (the lavafall on the cliff wall) follows the first magma flow
  let riverStart = 0;
  for (let i = 0; i < rPts.length; i++) {
    if (ctx.h(rPts[i][0], rPts[i][1]) < LAVA - 0.3) {
      riverStart = i;
      break;
    }
  }
  const cascade = rPts.slice(0, Math.min(rPts.length, riverStart + 4)).map(([x, z]) => new THREE.Vector3(x, 0, z));
  const n0 = flows[0].pts.length;
  flows[0].pts.push(...cascade);
  const n1 = flows[0].pts.length;
  flows[0].width = (t: number) => {
    const i = t * (n1 - 1);
    if (i < n0) return 1.6 + (i / n0) * 1.0;
    const k = (i - n0) / Math.max(1, n1 - n0);
    return 2.6 + (riverHalfWidth(0) - 2.6 + 0.6) * k;
  };
  const lavaMat = lavaMaterial({ speed: 0.9, stretch: 2.2, fogK: 0.3, gain: 0.72 });
  const geos = flows.map((f) =>
    ribbon(f.pts, f.width, (x, z) => {
      const m = Math.max(Math.abs(x), Math.abs(z));
      return Math.max(surf(x, z) + (m < S ? 0.35 : 0.5), LAVA + 0.06);
    }),
  );
  // the other two on the flank exist only in the far view: darker and taking a bit more fog, so that they do not look like
  // lightning
  const farMat = lavaMaterial({ speed: 0.6, stretch: 2.2, fogK: 0.55, gain: 0.5 });
  const flowMeshes = geos.map((g, i) => new THREE.Mesh(g, i === 0 ? lavaMat : farMat));
  for (const m of flowMeshes) ctx.group.add(m);

  // ── Crater: lava lake, glow, rubble on the crater rim
  const craterY = volcanoH(VOLC[0], VOLC[1]) + 3.2;
  const crater = new THREE.Vector3(VOLC[0], craterY, VOLC[1]);
  const poolGeo = new THREE.CircleGeometry(VOLC_RIM * 0.72, 28);
  poolGeo.rotateX(-Math.PI / 2);
  const pp = poolGeo.attributes.position;
  const edge = new Float32Array(pp.count);
  const uv = poolGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) {
    edge[i] = Math.hypot(pp.getX(i), pp.getZ(i)) / (VOLC_RIM * 0.72);
    uv.setXY(i, pp.getX(i) / 4, pp.getZ(i) / 8 + 0.5);
  }
  poolGeo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  const poolMat = lavaMaterial({ speed: 0.15, fogK: 0.25, gain: 1.25 });
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.position.copy(crater);
  ctx.group.add(pool);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(VOLC_RIM * 1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a2a).multiplyScalar(0.7), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }),
  );
  halo.scale.set(1, 0.7, 1);
  halo.position.copy(crater).setY(craterY - 2);
  ctx.group.add(halo);

  // ── Smoke plume: two layers of conical shell
  const plumeMat = plumeMaterial();
  const plumes: THREE.Mesh[] = [];
  for (const [r0, r1, h, oy] of [
    [9, 60, 190, 0],
    [6, 42, 150, 6],
  ] as const) {
    const g = new THREE.CylinderGeometry(r1, r0, h, 28, 24, true);
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, plumeMat);
    m.position.copy(crater).setY(craterY + oy - 4);
    m.renderOrder = 5;
    ctx.group.add(m);
    plumes.push(m);
  }

  // ── Sky: a volcanic ash canopy laid over the engine's sky (follows the camera)
  const volcDir = new THREE.Vector3(VOLC[0], 0, VOLC[1]).normalize();
  const skyMat = skyMaterial(new THREE.Color(FOG), volcDir);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(820, 32, 16), skyMat);
  sky.renderOrder = -9;
  sky.frustumCulled = false;
  ctx.group.add(sky);
  let flashT = 4;
  let flash = 0;
  const flashDir = new THREE.Vector3();

  const mats = [lavaMat, farMat, poolMat, plumeMat, skyMat, halo.material as THREE.Material];
  ctx.disposers.push(() => {
    for (const m of mats) m.dispose();
    for (const g of geos) g.dispose();
    poolGeo.dispose();
    halo.geometry.dispose();
    for (const p of plumes) p.geometry.dispose();
    sky.geometry.dispose();
  });

  // ── Per frame: shader time, ejected rocks, crater smoke and sparks
  let bombT = 2;
  let sparkT = 0;
  let smokeT = 0;
  const up = new THREE.Vector3(0, 1, 0);
  const smokeDir = new THREE.Vector3(0.35, 1, 0.08);
  const p = new THREE.Vector3();
  const update = (dt: number, t: number, vfx: import('../../../vfx.ts').Vfx) => {
    lavaMat.uniforms.uTime.value = t;
    farMat.uniforms.uTime.value = t;
    poolMat.uniforms.uTime.value = t;
    plumeMat.uniforms.uTime.value = t;
    skyMat.uniforms.uTime.value = t;
    sky.position.copy(vfx.camPos);
    // volcanic lightning: a flash or two inside the plume
    flashT -= dt;
    if (flashT <= 0) {
      flashT = 5 + Math.random() * 9;
      flash = 1;
      flashDir.set(crater.x + 20 + Math.random() * 50, crater.y + 70 + Math.random() * 90, crater.z + (Math.random() - 0.5) * 30).sub(vfx.camPos).normalize();
      skyMat.uniforms.uFlashDir.value.copy(flashDir);
    }
    flash = Math.max(0, flash - dt * 5);
    const fl = flash > 0.55 ? flash : flash * (0.5 + 0.5 * Math.sin(t * 60));
    skyMat.uniforms.uFlash.value = fl;
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.08 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 4.3);
    // ejected rocks: thrown up in bursts, trailing fire as they fall back onto the flank
    bombT -= dt;
    if (bombT <= 0) {
      bombT = 1.6 + Math.random() * 3.2;
      const big = Math.random() < 0.35;
      vfx.emit({ pos: crater, count: big ? 14 : 6, color: [0xff5a10, 0xffa030, 0xffd070], speed: [16, big ? 34 : 24], dir: up, spread: 0.55, life: [3, 5.5], size: [2.2, 4.2], sizeEnd: 0.6, gravity: 9, drag: 0.05, radius: 5, intensity: 2.6 });
      if (big) vfx.smoke({ pos: crater, count: 4, color: [0x3a2a2e, 0x4a3438], speed: [6, 10], dir: up, spread: 0.4, life: [6, 9], size: [16, 26], sizeEnd: 2.2, gravity: -0.4, drag: 0.4, radius: 6 });
    }
    sparkT += dt;
    while (sparkT > 0.15) {
      sparkT -= 0.15;
      vfx.emit({ pos: crater, count: 2, color: [0xff6a1a, 0xffc040], speed: [6, 12], dir: up, spread: 0.4, life: [1.5, 2.6], size: [1.2, 2], gravity: 5, drag: 0.2, radius: 6, intensity: 2.2 });
    }
    smokeT += dt;
    while (smokeT > 0.4) {
      smokeT -= 0.4;
      p.copy(crater).add(new THREE.Vector3((Math.random() - 0.5) * 10, 2, (Math.random() - 0.5) * 10));
      vfx.smoke({ pos: p, count: 1, color: [0x2a1e22, 0x3a2a2e, 0x4a3438], speed: [5, 8], dir: smokeDir, spread: 0.2, life: [8, 11], size: [14, 22], sizeEnd: 2.4, gravity: -0.2, drag: 0.25 });
    }
  };
  void VOLC_H;
  return { out: { crater, riverStart }, update };
}
