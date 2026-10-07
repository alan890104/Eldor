// Rose Window Snail (model lab version, N, light + earth): its shell is like a cathedral's stained glass, and when the sun shines through it casts a picture on the ground; the rose window of the Holy City's cathedral was drawn after its shell.
// Identifying features: 1. A disc-shaped shell on its back with a rose window on each side: a sandstone frame and twelve stone mullions all curling in the same direction (which is also the shell's spiral),
// with red, blue, gold and green stained glass in the cells, and a faceted golden rose heart in the exact center (the apex of the shell). 2. A tiny bell tower on top of the shell (two stone pillars, a spire and a bronze bell).
// 3. The snail itself: a long foot pressed to the ground, two long eye stalks topped with dark shiny eyes, and two short tentacles; built after a real snail's anatomy, with no human face and no mouth drawn.
// Body shape: a flat, long foot and a raised head, with the shell carried at a slant (the window faces half forward, so the rose window shows from the front and from three-quarter views).
// Personality: an unhurried old cathedral keeper: all day it slowly crawls to wherever the sun is and turns its shell to the light. Personality comes from posture (head raised, the eye stalks gently probing one ahead of the other) and from motion.
// Gaze order: the rose window first, the eye stalks and head second, the bell tower third. Back: the other rose window (both sides are windows, so it is a picture from either side) and the back of the bell tower.
// Action table: idle has the foot rising and falling slowly in waves, the eye stalks slowly taking turns reaching forward, the shell swaying gently with breathing and the bell swinging now and then; move is a gliding with the foot rippling;
// charge-up act.glow brightens the stained glass; strike shoots refracted light from the rose heart (window); hit act.hide shortens the eye stalks and pulls the head toward the shell; victory raises the head and the bell swings once.
// Anchors: head, eyes, mouth (below the head), window / windowBack (rose hearts on the two sides), shell (center of the shell), bell (the bell).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, curveTable, lathe, loft, mergeStatic, partKit, PI, rbox, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Helpers ─────────────────────────

function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  if (!g.attributes.normal) g.computeVertexNormals();
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(p.fromBufferAttribute(pa, i), n.fromBufferAttribute(na, i));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** A tube with both ends rounded */
function tube(pts: THREE.Vector3[], r0: number, r1: number, segs = 12, radial = 8, side?: THREE.Vector3): THREE.BufferGeometry {
  return loft(pts, (t) => {
    const k = Math.min(1, Math.sqrt(t / 0.06), Math.sqrt((1 - t) / 0.06));
    const r = THREE.MathUtils.lerp(r0, r1, t) * k;
    return [r, r];
  }, { segs, radial, side });
}

// ───────────────────────── Shape ─────────────────────────

export function buildPrismsnailLab(): LabModel {
  const RIMC = 0xfff0d8;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    skin: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    stone: vc(labToon(0xffffff, { speckle: 0.07, rim: 0.5, rimColor: RIMC })),
    glass: vc(labToon(0xffffff, { ramp: 'gem', spec: 0.7, specTh: 0.975, emissive: 0x2a2a2a, emissiveAmt: 1, rim: 0.4, rimColor: 0xffffff })),
    rose: labToon(0xffe6a0, { ramp: 'gem', emissive: 0xffb840, emissiveAmt: 0.45, spec: 1.2, specTh: 0.9, rim: 0.4 }),
    bronze: labToon(0xc0893c, { ramp: 'metal', spec: 1.3, specTh: 0.9, rim: 0.5, rimColor: 0xffe0a8 }),
    eye: labToon(0x1a1216, { ramp: 'gem', spec: 0.6, specTh: 0.95, rim: 0.1 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'prismsnail-lab';
  const { add, group } = partKit();
  const BODY = 9631;

  const pose = group(root);
  const body = group(pose, [0, -0.007, 0.0]);

  // ── Foot: a flat, long body pressed to the ground with the front raised into the head; gray rose-brown on the back, a light edge on the belly side, with fine grooves ──
  const cSkin = col(0xb99288);
  const cSkinDk = col(0x98746c);
  const cSole = col(0xefdcca);
  const bodyPts = [v(0, 0.035, -0.6), v(0, 0.06, -0.38), v(0, 0.08, -0.1), v(0, 0.1, 0.15), v(0, 0.17, 0.32), v(0, 0.27, 0.42), v(0, 0.34, 0.455)];
  const bodyProf = curveTable([[0, 0, 0], [0.07, 0.05, 0.03], [0.32, 0.15, 0.065], [0.58, 0.165, 0.08], [0.76, 0.125, 0.09], [0.9, 0.1, 0.095], [0.97, 0.07, 0.07], [1, 0, 0]]);
  add(body, paint(loft(bodyPts, (t) => bodyProf(t), { segs: 48, radial: 22, side: v(1, 0, 0) }), (p, n) => {
    const c = cSkin.clone().lerp(cSkinDk, ss(n.y, 0.5, 0.95) * (0.5 + 0.5 * Math.sin(p.z * 60)) * 0.45);
    return c.lerp(cSole, ss(-n.y + 0.2 * Math.abs(n.x), 0.1, 0.5));
  }), M.skin).userData.inkGroup = BODY;

  // ── Head: two long eye stalks topped with dark shiny eyes, and two short tentacles reaching forward and down ──
  const HEAD = v(0, 0.34, 0.44);
  const stalks: { g: THREE.Group; sx: number; eye: THREE.Group }[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const ER = 0.036;
  const hiGeo = new THREE.SphereGeometry(1, 10, 6);
  for (const sx of [-1, 1]) {
    const base = HEAD.clone().add(v(sx * 0.04, 0.0, -0.01));
    const g = group(body, base.toArray() as [number, number, number]);
    // The two eye stalks spread into a V, and in the front silhouette they also stick out past the shell
    const tip = v(sx * 0.19, 0.26, 0.08);
    add(g, paint(tube([v(0, -0.04, 0), v(sx * 0.04, 0.08, 0.025), v(sx * 0.12, 0.19, 0.06), tip], 0.026, 0.016, 18, 10), (_p, n) => cSkin.clone().lerp(cSole, ss(-n.z, 0.2, 0.9) * 0.3)), M.skin);
    // The small ball at the top of the eye stalk, with the dark shiny eye set in its front
    const eg = group(g, tip.toArray() as [number, number, number]);
    add(eg, paint(new THREE.SphereGeometry(0.03, 14, 10), () => cSkin), M.skin);
    const eye = group(eg, [0, 0.004, 0.012]);
    add(eye, new THREE.SphereGeometry(ER, 18, 12), M.eye);
    for (const [lx, ly, r] of [[-0.35, 0.35, 0.011], [0.3, -0.3, 0.0055]] as [number, number, number][]) {
      const d = v(Math.sin(lx), Math.sin(ly), 1).normalize();
      const hl = add(eye, hiGeo, M.hi, d.clone().multiplyScalar(ER + 0.002).toArray() as [number, number, number], [0, 0, 0], [r, r, r * 0.45]);
      hl.quaternion.setFromUnitVectors(FWD, d);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(eye, [0, 0, ER]));
    stalks.push({ g, sx, eye });
    // Lower tentacles: short, pointing forward and down
    add(body, paint(tube([HEAD.clone().add(v(sx * 0.035, -0.06, 0.02)), HEAD.clone().add(v(sx * 0.07, -0.08, 0.08)), HEAD.clone().add(v(sx * 0.09, -0.11, 0.12))], 0.017, 0.011, 10, 8), () => cSkin), M.skin);
  }

  // ── Shell: disc-shaped, axis along x, carried at a slant (the window faces half forward); sandstone frame plus growth lines ──
  const SC = v(0, 0.5, -0.14);
  const shellG = group(body, SC.toArray() as [number, number, number], [0.08, -0.45, 0]);
  const R = 0.4;
  const cSand = col(0xeadcc0);
  const cSandDk = col(0xc4ad88);
  const cBand = col(0xb89a74);
  const sandColor = (p: THREE.Vector3, n: THREE.Vector3) => {
    const a = Math.atan2(p.y, p.z);
    const c = cSand.clone().lerp(cSandDk, ss(-n.y, 0.1, 0.9) * 0.6);
    return c.lerp(cBand, ss(Math.sin(a * 18), 0.75, 0.95) * ss(Math.hypot(p.y, p.z), 0.3, 0.36) * 0.6);
  };
  {
    const prof: [number, number][] = [[0.001, 0.122], [0.335, 0.12], [0.362, 0.11], [0.386, 0.085], [0.401, 0.045], [0.406, 0], [0.401, -0.045], [0.386, -0.085], [0.362, -0.11], [0.335, -0.12], [0.001, -0.122]];
    const g = lathe(prof, 56).rotateZ(-PI / 2);
    g.deleteAttribute('uv');
    add(shellG, paint(g, sandColor), M.stone);
  }
  // Rose window (both sides): a ring of stained glass, twelve stone mullions curling in the same direction, inner and outer stone rings, and a faceted rose heart in the exact center
  const R0 = 0.095;
  const R1 = 0.315;
  const TW = 1.1; // The angle the mullions turn through from the inner ring to the outer ring (the shell's spiral)
  const NS = 12;
  const pal = [col(0xd83c4a), col(0x3a68d6), col(0xf0b02c), col(0x2f9e6a)];
  const roses: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const face = group(shellG, [sx * 0.121, 0, 0], [0, sx * PI / 2, 0]);
    // In face coordinates: the window plane is the xy plane, facing +z
    const glass = new THREE.RingGeometry(R0, R1 + 0.01, 72, 4);
    glass.deleteAttribute('uv');
    paint(glass, (p) => {
      const r = Math.hypot(p.x, p.y);
      const th = Math.atan2(p.y, p.x) + sx * TW * (r - R0) / (R1 - R0);
      const k = ((Math.floor((th / (PI * 2)) * NS) % NS) + NS) % NS;
      return pal[k % 4].clone().lerp(col(0xffffff), ss(r, R0, R1) * 0.25);
    });
    add(face, glass, M.glass, [0, 0, 0.002]);
    // Mullions: along the color boundary lines (the same spiral)
    for (let k = 0; k < NS; k++) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 6; i++) {
        const r = R0 + ((R1 - R0) * i) / 6;
        const th = (k / NS) * PI * 2 - sx * TW * (r - R0) / (R1 - R0);
        pts.push(v(Math.cos(th) * r, Math.sin(th) * r, 0.006));
      }
      add(face, paint(tube(pts, 0.013, 0.013, 12, 6), sandColor), M.stone);
    }
    add(face, paint(new THREE.TorusGeometry(R0, 0.02, 8, 40), sandColor), M.stone, [0, 0, 0.006]);
    add(face, paint(new THREE.TorusGeometry(R1 + 0.012, 0.024, 8, 56), sandColor), M.stone, [0, 0, 0.004]);
    const rose = group(face, [0, 0, 0.01]);
    add(rose, brilliant(0.07, 0.035, 0.02, 12).rotateX(PI / 2), M.rose);
    roses.push(rose);
  }

  // ── Small bell tower on top of the shell: two stone pillars, a spire and a bronze bell ──
  const tower = group(shellG, [0, R - 0.012, 0]);
  tower.scale.setScalar(0.8);
  {
    const towerColor = (p: THREE.Vector3, n: THREE.Vector3) => sandColor(p.clone().multiplyScalar(0.2), n);
    add(tower, paint(rbox(0.1, 0.05, 0.16, 0.012, 2), towerColor), M.stone, [0, 0.0, 0]);
    for (const z of [-0.055, 0.055]) add(tower, paint(rbox(0.05, 0.12, 0.028, 0.008, 1), towerColor), M.stone, [0, 0.08, z]);
    // Spire: a four-sided pyramid (four lathe segments turned by 45 degrees), with a lintel underneath
    add(tower, paint(rbox(0.07, 0.022, 0.15, 0.007, 1), towerColor), M.stone, [0, 0.148, 0]);
    add(tower, paint(lathe([[0.001, 0], [0.085, 0], [0.001, 0.12]], 4).rotateY(PI / 4).scale(0.62, 1, 1.05), towerColor), M.stone, [0, 0.158, 0]);
  }
  const bell = group(tower, [0, 0.14, 0]);
  add(bell, lathe([[0.001, -0.052], [0.03, -0.052], [0.027, -0.044], [0.021, -0.02], [0.016, -0.006], [0.001, 0.0]], 12), M.bronze);
  add(bell, new THREE.SphereGeometry(0.008, 8, 6), M.bronze, [0, -0.056, 0]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  const rig = {
    head: group(body, HEAD.clone().add(v(0, -0.02, 0.02)).toArray() as [number, number, number]),
    eyes: eyeAnchors,
    anchors: {
      mouth: group(body, HEAD.clone().add(v(0, -0.1, 0.06)).toArray() as [number, number, number]),
      window: group(roses[1], [0, 0, 0.03]),
      windowBack: group(roses[0], [0, 0, 0.03]),
      shell: group(shellG),
      bell: group(bell, [0, -0.03, 0]),
    },
  };
  const act = { glow: 0, hide: 0 };

  mergeStatic(root, {
    owners: [pose, body, shellG, tower, bell, ...stalks.map((s) => s.g), ...stalks.map((s) => s.eye)],
    keep: [...glints],
    rig,
  });

  // ── Idle ──
  const update = (t: number, _dt: number) => {
    const gl = act.glow;
    const hd = act.hide;
    // The foot rises and falls in waves (very slowly overall), and the shell sways gently along
    body.scale.set(1 + Math.sin(t * 1.1) * 0.006, 1 + Math.sin(t * 1.1 + 1) * 0.01, 1 - hd * 0.08);
    shellG.rotation.set(0.08 + Math.sin(t * 0.8) * 0.015, -0.45 + Math.sin(t * 0.35) * 0.03, Math.sin(t * 0.55) * 0.02);
    // The eye stalks take turns reaching forward (both eyes look the same direction, only the stalks' lengths are staggered front and back)
    for (const s of stalks) {
      const ph = s.sx > 0 ? 0 : 1.6;
      const reach = Math.sin(t * 0.7 + ph);
      s.g.rotation.set(0.12 + reach * 0.1, Math.sin(t * 0.33) * 0.12, -s.sx * (0.04 + Math.sin(t * 0.5 + ph) * 0.05));
      s.g.scale.set(1, 1 - hd * 0.6, 1);
      s.eye.rotation.set(-0.12 - reach * 0.1, 0, 0);
    }
    // The bell swings gently now and then
    bell.rotation.x = Math.max(0, Math.sin(t * 0.45) - 0.8) * 1.2 * Math.sin(t * 5);
    M.glass.emissiveIntensity = 1 + gl * 4;
    M.rose.emissiveIntensity = 0.45 + gl * 1.0 + Math.sin(t * 0.9) * 0.05;
  };
  update(0, 0);

  return { root, update, center: new THREE.Vector3(0, 0.45, 0), radius: 0.78, rig, act };
}
