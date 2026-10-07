// Astragate (Astra), the Star Gate Warden (model lab version): a stone beast guarding the gate, built of city-wall stone.
// Keeps the four things that made the old design easiest to recognize: the pale city-wall stone, the gold trim, the starglow stone on the chest and the Star Gate; the body becomes a stone lion sitting before the gate,
// the Star Gate's arch stones are the mane framing the face, the spine is a run of battlements stepping down, and the forehead and the top of the arch each carry a keystone (this spirit's mark).
// Personality: an old guard who holds his post to the death and never smiles. Heavy brows pressed low, eyelids half lowered, the lower jaw jutting out to show two small fangs, sitting bolt upright with the chest thrust out.
// Every seam is a truly separate block of stone with a recessed layer of mortar behind it; hard parts are all beveled.
// Action weights (act): wake opens the eyes and looks straight ahead; roar opens the lower jaw (starglow shows through the mouth), tilts the head back and lays both ears flat outward; glow brightens the starglow stones on the chest, the keystone and the tail end, and the star curtain in the gate opening.
// Anchors: head, eyes, mouth (inside the mouth), keystone (the keystone at the top of the arch), heart (the starglow stone on the chest), door (center of the door behind it).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, lathe, mergeStatic, outline, partKit, PI, rbox, rng, slab, taper, wedge, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

// ───────────────────────── Shape ─────────────────────────

export function buildAstragateLab(): LabModel {
  const rand = rng(20260927);
  const jit = (a: number) => (rand() - 0.5) * 2 * a;

  const M = {
    face: labToon(0xf2ead9, { speckle: 0.06, rim: 0.55 }),
    stone: labToon(0xded2bb, { speckle: 0.09, rim: 0.5 }),
    arch: labToon(0xc2b397, { speckle: 0.1, rim: 0.55 }),
    mortar: labToon(0x6c6270, { rim: 0.2 }),
    slate: labToon(0x4b4f66, { spec: 0.9, specTh: 0.93, rim: 0.45 }),
    ivory: labToon(0xfbf5e6, { rim: 0.5 }),
    gold: labToon(0xe2ad48, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6 }),
    gem: labToon(0x6fcaff, { ramp: 'gem', emissive: 0x2a8fe0, emissiveAmt: 0.55, spec: 1.4, specTh: 0.88, rim: 0.7 }),
    eye: labToon(0xc9f1ff, { ramp: 'gem', emissive: 0x58c4ff, emissiveAmt: 0.62, rim: 0.3 }),
    pupil: labToon(0x1d2340, { spec: 1.2, specTh: 0.9, rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'astragate-lab';

  const kit = partKit();
  const { add, group } = kit;
  /** Gold rivet, dome facing n */
  const rivet = (parent: THREE.Object3D, pos: V3, n: V3, r = 0.013) => kit.rivet(parent, M.gold, pos, n, r);

  // Body (rises and falls slightly with breathing); the four feet hang directly on root so they stand firmly on the ground
  const body = group(root);

  // ── Seated torso: an upright chest block, a belly block sitting down at a slant toward the back (mortar core plus staggered-joint stone on both sides), and a rump base on the ground ──
  // Chest block: three stones around a mortar core, the wide one in the middle set with the starglow stone and the narrow ones on either side set back slightly, with a collar stone pressed along the top edge
  const chest = group(body, [0, 0.52, 0.08], [-0.1, 0, 0]);
  add(chest, rbox(0.46, 0.56, 0.32, 0.1), M.mortar);
  add(chest, rbox(0.29, 0.52, 0.34, 0.08), M.stone, [0, -0.02, 0.02]);
  for (const sx of [-1, 1]) add(chest, rbox(0.1, 0.5, 0.3, 0.045), M.stone, [sx * 0.2, -0.02, 0.0], [jit(0.02), 0, jit(0.02)]);
  add(chest, rbox(0.5, 0.075, 0.3, 0.03), M.arch, [0, 0.27, -0.005]);
  const belly = group(body, [0, 0.37, -0.15], [0.55, 0, 0]);
  add(belly, rbox(0.44, 0.38, 0.44, 0.11), M.mortar);
  for (const sx of [-1, 1]) {
    for (const [cy, zs] of [[-0.095, [[-0.11, 0.2], [0.11, 0.2]]], [0.095, [[-0.16, 0.1], [0.06, 0.3]]]] as [number, [number, number][]][]) {
      for (const [cz, len] of zs) {
        add(belly, rbox(0.07, 0.17, len - 0.024, 0.028), M.stone, [sx * (0.22 + jit(0.005)), cy + jit(0.004), cz], [jit(0.03), jit(0.03), jit(0.03)]);
      }
    }
  }
  add(body, rbox(0.54, 0.22, 0.46, 0.09), M.stone, [0, 0.12, -0.3]);

  // Spine: three battlements stepping down in a run, like a city wall built down a hillside
  for (const [t, h] of [[0.18, 0.15], [0.5, 0.13], [0.82, 0.11]] as [number, number][]) {
    const y = THREE.MathUtils.lerp(0.78, 0.3, t);
    const z = THREE.MathUtils.lerp(-0.12, -0.5, t);
    add(body, rbox(0.3, h + 0.08, 0.13, 0.03), M.arch, [jit(0.006), y + h / 2 - 0.02, z], [jit(0.03), jit(0.05), jit(0.03)]);
  }

  // ── Starlight Stone on the chest: gold seat, six claw prongs, four rivets ──
  const socket = group(chest, [0, 0.02, 0.195]);
  add(socket, lathe([[0.066, -0.02], [0.092, -0.02], [0.102, 0.0], [0.094, 0.022], [0.074, 0.026], [0.064, 0.012]], 40), M.gold, [0, 0, 0], [PI / 2, 0, 0]);
  add(socket, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 32), M.mortar, [0, 0, -0.008], [PI / 2, 0, 0]);
  add(socket, brilliant(0.07, 0.042, 0.05, 10), M.gem, [0, 0, 0.012], [PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6;
    add(socket, rbox(0.02, 0.028, 0.02, 0.008), M.gold, [Math.cos(a) * 0.073, Math.sin(a) * 0.073, 0.03], [0, 0, a - PI / 2]);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    rivet(socket, [Math.cos(a) * 0.14, Math.sin(a) * 0.12, -0.004], [0, 0, 1], 0.014);
  }

  // ── Front legs: two stone pillars with a recessed mortar joint ring in the middle, the ankle banded in gold, and a rivet on the front and on the outside ──
  for (const sx of [-1, 1]) {
    const leg = group(root, [sx * 0.2, 0, 0.21]);
    add(leg, rbox(0.175, 0.27, 0.185, 0.055), M.stone, [0, 0.44, 0], [0, 0, sx * 0.03]);
    add(leg, new THREE.CylinderGeometry(0.06, 0.06, 0.1, 20), M.mortar, [0, 0.29, 0]);
    add(leg, rbox(0.158, 0.17, 0.168, 0.045), M.stone, [0, 0.19, 0.005]);
    add(leg, rbox(0.176, 0.045, 0.186, 0.015), M.gold, [0, 0.106, 0.005]);
    rivet(leg, [0, 0.106, 0.1], [0, 0, 1], 0.011);
    rivet(leg, [sx * 0.09, 0.106, 0.005], [sx, 0, 0], 0.011);
    add(leg, rbox(0.2, 0.085, 0.24, 0.035), M.stone, [0, 0.043, 0.035]);
    for (let i = -1; i <= 1; i++) add(leg, rbox(0.058, 0.056, 0.07, 0.022), M.stone, [i * 0.064, 0.028, 0.165]);
  }
  // ── Hind legs: thigh blocks bulging out in the seated pose, hind paws reaching forward ──
  for (const sx of [-1, 1]) {
    const leg = group(root, [sx * 0.3, 0, -0.16]);
    add(leg, rbox(0.2, 0.32, 0.38, 0.1), M.stone, [0, 0.2, 0], [0.15, 0, sx * -0.05]);
    add(leg, rbox(0.17, 0.08, 0.24, 0.032), M.stone, [sx * 0.02, 0.04, 0.2]);
    for (let i = -1; i <= 1; i++) add(leg, rbox(0.052, 0.05, 0.06, 0.02), M.stone, [sx * 0.02 + i * 0.056, 0.026, 0.33]);
  }

  // ── Tail: three stone segments curling up from behind the rump base, a gold band between the segments, and a cluster of starglow crystals at the end ──
  const tail = group(body, [0, 0.2, -0.5], [-1.0, 0, 0]);
  let link: THREE.Object3D = tail;
  const sizes = [0.12, 0.105, 0.09];
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    add(link, rbox(s, s * 1.1, s, s * 0.3), M.stone, [0, s * 0.55, 0], [0, jit(0.1), 0]);
    if (i > 0) add(link, rbox(s * 1.12, 0.03, s * 1.12, 0.012), M.gold, [0, 0, 0]);
    link = group(link, [0, s * 1.14, 0], [0.5, 0, 0]);
  }
  for (const [rz, sc] of [[0, 1], [0.42, 0.72], [-0.38, 0.64]] as [number, number][]) {
    add(link, new THREE.OctahedronGeometry(0.05, 0), M.gem, [Math.sin(rz) * 0.03, 0.06 * sc + 0.02, 0], [0, rz * 2, rz], [0.55 * sc, 1.6 * sc, 0.55 * sc]);
  }

  // ── Head: the neck pivot is above the chest block, and the head's origin is at the center of the skull ──
  const neck = group(body, [0, 0.84, 0.12]);
  const head = group(neck, [0, 0.27, 0.08]);
  head.scale.setScalar(1.08);

  // Skull: a block wide at the top and narrow at the bottom
  add(head, taper(rbox(0.58, 0.46, 0.46, 0.1, 4), [1, 1], [0.88, 0.92]), M.face);
  // Heavy brows: two stones pressing on the eyes, low on the inside and high on the outside
  for (const sx of [-1, 1]) {
    add(head, taper(rbox(0.25, 0.09, 0.15, 0.036), [0.96, 0.9], [1, 1]), M.stone, [sx * 0.132, 0.118, 0.205], [0.18, sx * 0.2, sx * 0.21]);
  }
  // Star Gate mane: a horseshoe-shaped arch surrounds the whole face, and the eleven arch stones sweep back more the farther out they are, so from the side they read as a ring of mane.
  // The keystone is directly above the top of the head, set with a piece of gold and a starglow stone; both ends rest on the gold-banded imposts. The gate opening holds a faint star curtain.
  const mane = group(head, [0, -0.02, -0.06]);
  const NV = 11;
  const gap = 0.05;
  const span0 = -0.32;
  const span1 = PI + 0.32;
  const rIn = 0.35;
  // Each arch stone turns back as a whole about its inner edge (rigid rotation, the faces stay flat), so the outer edge sweeps back
  const sweep = Math.atan(0.6);
  let keyStone: THREE.Group | null = null;
  for (let i = 0; i < NV; i++) {
    const a0 = span0 + ((span1 - span0) * i) / NV + gap / 2;
    const a1 = span0 + ((span1 - span0) * (i + 1)) / NV - gap / 2;
    const am = (a0 + a1) / 2;
    const key = i === (NV - 1) / 2;
    const rOut = key ? 0.575 : 0.475 + (i % 2) * 0.035;
    const pivot = group(mane, [Math.cos(am) * rIn, Math.sin(am) * rIn, 0]);
    pivot.quaternion.setFromAxisAngle(new THREE.Vector3(-Math.sin(am), Math.cos(am), 0), sweep);
    const inner = group(pivot, [-Math.cos(am) * rIn, -Math.sin(am) * rIn, key ? 0.012 : jit(0.008)]);
    add(inner, slab(wedge(rIn, rOut, a0, a1), key ? 0.17 : 0.14, 0.014, 6), key ? M.stone : M.arch);
    if (key) keyStone = inner;
  }
  // The front of the keystone is set with a piece of gold and a starglow stone (hung under the keystone, sweeping back with it)
  add(keyStone!, slab(outline([[-0.046, 0.445], [0.046, 0.445], [0.064, 0.535], [-0.064, 0.535]]), 0.024, 0.008), M.gold, [0, 0, 0.085 + 0.014 + 0.012]);
  add(keyStone!, new THREE.OctahedronGeometry(0.03, 0), M.gem, [0, 0.49, 0.085 + 0.014 + 0.034], [0, 0, 0], [0.85, 1.2, 0.55]);
  // The back of the gate is a closed stone door: five upright stone slabs, two gold door bands, and a rivet on each slab
  const door = group(mane, [0, 0, -0.2]);
  const dr = rIn + 0.005;
  const doorBottom = -0.26;
  const strips = 5;
  for (let i = 0; i < strips; i++) {
    const x0 = -dr + (2 * dr * i) / strips + 0.012;
    const x1 = -dr + (2 * dr * (i + 1)) / strips - 0.012;
    const pts: [number, number][] = [[x0, doorBottom], [x1, doorBottom]];
    for (let k = 0; k <= 6; k++) {
      const x = x1 + ((x0 - x1) * k) / 6;
      pts.push([x, Math.max(doorBottom + 0.02, Math.sqrt(Math.max(0, dr * dr - x * x)) - 0.012)]);
    }
    add(door, slab(outline(pts), 0.045, 0.01, 4), M.arch, [0, 0, jit(0.006)]);
  }
  for (const y of [0.13, -0.12]) {
    const half = Math.sqrt(dr * dr - y * y) - 0.03;
    add(door, rbox(half * 2, 0.04, 0.02, 0.008), M.gold, [0, y, -0.037]);
    for (let i = 0; i < strips; i++) {
      const x = -dr + (2 * dr * (i + 0.5)) / strips;
      if (Math.abs(x) < half - 0.02) rivet(door, [x, y, -0.047], [0, 0, -1], 0.011);
    }
  }
  for (const sx of [-1, 1]) {
    // The impost sits below the end face of the last arch stone at the end of the arch, with its top face parallel to the end face
    const a = sx > 0 ? span0 : span1;
    const out = new THREE.Vector2(sx * Math.sin(a), -sx * Math.cos(a));
    const imp = group(mane, [Math.cos(a) * 0.41 + out.x * 0.035, Math.sin(a) * 0.41 + out.y * 0.035, -0.03], [0, 0, sx > 0 ? a : a - PI]);
    add(imp, rbox(0.17, 0.06, 0.17, 0.022), M.arch, [0, 0, 0]);
    add(imp, rbox(0.15, 0.035, 0.15, 0.012), M.gold, [0, -0.048, 0]);
    rivet(imp, [0, -0.048, 0.076], [0, 0, 1], 0.01);
  }
  const veilShape = new THREE.Shape();
  veilShape.absarc(0, 0, rIn + 0.01, 0, PI * 2, false);
  const veilMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uGlow;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        vec3 c = mix(vec3(0.84, 0.94, 1.0), vec3(0.45, 0.7, 1.0), smoothstep(0.2, 0.36, r));
        vec2 q = vP * 26.0 + vec2(0.0, uTime * 0.25);
        vec2 id = floor(q);
        float h = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
        float star = step(0.88, h) * smoothstep(0.22, 0.0, length(fract(q) - 0.5)) * (0.55 + 0.45 * sin(uTime * 1.7 + h * 40.0));
        c = mix(c, vec3(1.0, 0.95, 0.8), uGlow * 0.35);
        gl_FragColor = vec4(c + star * (0.7 + uGlow * 0.5), 0.55 + star * 0.4 + uGlow * 0.25);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const veil = new THREE.Mesh(new THREE.ShapeGeometry(veilShape, 32), veilMat);
  veil.position.z = -0.1;
  mane.add(veil);

  // Eyes: recessed sockets, glowing starglow-stone eyeballs, upright pupils, a highlight fixed at the upper left, and half-lowered stone eyelids
  const lids: THREE.Group[] = [];
  const pupils: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    add(head, rbox(0.165, 0.105, 0.05, 0.02), M.mortar, [sx * 0.13, 0.03, 0.208]);
    add(head, new THREE.SphereGeometry(0.056, 24, 16), M.eye, [sx * 0.13, 0.028, 0.226], [0, 0, 0], [1.12, 0.8, 0.42]);
    const pupil = add(head, rbox(0.026, 0.066, 0.014, 0.012), M.pupil, [sx * 0.124, 0.024, 0.246]);
    pupils.push(pupil);
    const hl = add(head, new THREE.SphereGeometry(0.011, 10, 8), M.hi, [sx * 0.13 - 0.018, 0.047, 0.252]);
    hl.layers.disable(INK_LAYER);
    const lid = group(head, [sx * 0.13, 0.083, 0.236]);
    add(lid, rbox(0.176, 0.1, 0.04, 0.016), M.stone, [0, -0.05, 0]);
    lid.scale.y = 0.3;
    lids.push(lid);
  }

  // Ears: a pair of small stone ears standing slanted at the upper corners of the skull, in front of the arch stones, with a dark stone piece on the inside; they twitch now and then
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const ear = group(head, [sx * 0.245, 0.2, 0.05], [-0.1, sx * 0.3, -sx * 0.75]);
    add(ear, taper(rbox(0.11, 0.12, 0.05, 0.022), [0.4, 0.75]), M.face, [0, 0.05, 0]);
    add(ear, taper(rbox(0.064, 0.072, 0.02, 0.009), [0.35, 0.8]), M.arch, [0, 0.046, 0.024]);
    ears.push(ear);
  }

  // Muzzle: bulging cheeks, a square muzzle, a nose of dark polished stone, a jutting lower jaw and two small fangs
  for (const sx of [-1, 1]) add(head, rbox(0.17, 0.16, 0.17, 0.07), M.face, [sx * 0.2, -0.105, 0.13], [0, sx * 0.35, sx * 0.08]);
  add(head, rbox(0.34, 0.16, 0.24, 0.07), M.face, [0, -0.1, 0.215]);
  add(head, taper(rbox(0.13, 0.064, 0.07, 0.027), [1, 1], [0.62, 0.8]), M.slate, [0, -0.03, 0.318], [0.12, 0, 0]);
  add(head, rbox(0.27, 0.03, 0.2, 0.012), M.mortar, [0, -0.181, 0.22]);
  // The lower jaw's pivot is at the back, and the whole block turns down when the mouth opens; inside the mouth is a glowing starglow stone, hidden inside the lower jaw when the mouth is closed
  const jaw = group(head, [0, -0.2, 0.15]);
  add(jaw, rbox(0.29, 0.085, 0.19, 0.036), M.stone, [0, -0.03, 0.1]);
  for (const sx of [-1, 1]) add(jaw, new THREE.ConeGeometry(0.024, 0.08, 10), M.ivory, [sx * 0.1, 0.035, 0.175], [0.12, 0, sx * -0.12]);
  add(head, rbox(0.23, 0.08, 0.15, 0.025), M.eye, [0, -0.215, 0.235]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle action: breathing, slow looking around, blinking, an occasional ear twitch, the tail swaying lightly, the starglow stones flickering faintly ──
  const act = { wake: 0, roar: 0, glow: 0 };
  let blinkIn = 2.2;
  let blinkT = -1;
  const update = (t: number, dt: number) => {
    const { wake, roar, glow } = act;
    // No more looking around once the eyes are open or the mouth is open; it looks straight ahead
    const still = 1 - Math.max(wake, roar);
    const br = Math.sin(t * 1.5);
    const puff = 1 + roar * 0.03;
    chest.scale.set((1 + br * 0.012) * puff, (1 + br * 0.008) * puff, (1 + br * 0.01) * puff);
    body.position.y = br * 0.004;
    neck.position.y = 0.84 + br * 0.006;
    head.rotation.y = (Math.sin(t * 0.37) * 0.16 + Math.sin(t * 1.07) * 0.03) * still;
    head.rotation.x = Math.sin(t * 0.61) * 0.035 * still - roar * 0.16;
    head.rotation.z = Math.sin(t * 0.37 + 0.6) * 0.035 * still;
    jaw.rotation.x = roar * 0.9;
    for (const p of pupils) p.position.x = Math.sign(p.position.x) * 0.124 + Math.sin(t * 0.37 - 0.4) * 0.006;

    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 2.5 + ((t * 7.3) % 3);
    }
    const open = 0.3 - wake * 0.26;
    let lid = open;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT / 0.18;
      lid = k < 1 ? open + Math.sin(k * PI) * (1.02 - open) * (1 - wake) : open;
      if (k >= 1) blinkT = -1;
    }
    for (const l of lids) l.scale.y = lid;

    for (let i = 0; i < ears.length; i++) {
      // Twitches once every few seconds, the two ears staggered
      const sx = i === 0 ? -1 : 1;
      const ph = (t + i * 2.3) % 5.5;
      const tw = ph < 0.35 ? Math.sin(ph * 36) * (1 - ph / 0.35) * 0.22 : 0;
      ears[i].rotation.z = -sx * (0.75 + roar * 0.45) + sx * tw * still;
    }
    tail.rotation.z = Math.sin(t * 0.9) * 0.1;
    tail.rotation.x = -1.0 + Math.sin(t * 1.3) * 0.04;
    M.gem.emissiveIntensity = 0.55 + Math.sin(t * 1.5) * 0.08 + glow * 0.5;
    M.eye.emissiveIntensity = 0.62 + Math.max(wake * 0.25, glow * 0.4);
    veilMat.uniforms.uTime.value = t;
    veilMat.uniforms.uGlow.value = glow;
  };
  update(0, 0);

  const eyes = [-1, 1].map((sx) => group(head, [sx * 0.13, 0.028, 0.25]));
  const anchors = {
    mouth: group(head, [0, -0.205, 0.3]),
    keystone: group(keyStone!, [0, 0.49, 0.16]),
    heart: group(socket, [0, 0, 0.05]),
    door: group(door, [0, 0, -0.07]),
  };
  const rig = { head, eyes, anchors };
  // Draw calls: parts that never move on their own are merged into the groups that do move (the breathing chest block, neck, head, lower jaw, eyelids, ears, tail); the pupils move left and right on their own, so they are not merged
  mergeStatic(root, { owners: [body, chest, neck, jaw, tail, ...lids, ...ears], keep: pupils, rig });
  return { root, update, act, rig, center: new THREE.Vector3(0, 0.84, 0.02), radius: 0.98 };
}
