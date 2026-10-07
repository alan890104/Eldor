// Dev only: model lab for a single spirit (add ?lab=<spirit id> to the URL, default astragate).
// The list on the left shows every spirit: ones already redone show the lab version (LAB_MODELS), ones not yet redone show the current in-game model as a baseline; a redone one can be switched to the in-game model for comparison.
// Clean gradient background, soft shadow under the feet, key light + sky light + rim light; the lab version's outline uses inkPipeline's post-process edge detection.
// The character turns slowly on its own; drag the view to turn it by hand, and the buttons switch to front, three-quarter, side and back. Keyboard ↑↓ picks the previous / next one.
// Params: &old (view the in-game model of a redone spirit), &stage=1|2|3|all (Breakthrough stage; all is the three stages side by side, default 3), &yaw=radians (fixed angle, no auto turn),
//       &sil (silhouette), &mini (shrunken preview at the bottom right), &t=seconds (freeze the idle animation at that time), &act=roar:1,wake:0.5 (action weights as in the cutscene, for checking animations)
// window.__lab: { pick(id, old, stage), stage(s), yaw(v), auto(on), sil(on), mini(on), freeze(t), stats() }, for screenshot scripts.

import * as THREE from 'three';
import { SPIRITS } from '../data.ts';
import { InkPipeline, SUPERSAMPLE } from '../render/lab/inkPipeline.ts';
import type { LabModel, LabStage } from '../render/lab/shapes.ts';
import { SPIRIT_RIG, updateRim } from '../render/lab/toonKit.ts';
import { CHAR_LAB_NAMES } from '../render/field/avatarLab.ts';
import { LAB_BUILDERS as LAB_MODELS, labLocalHeight } from '../render/labCreature.ts';
import { LIGHT } from '../render/toon.ts';
import { buildCreature, TARGET } from '../render/species.ts';

/** 0 is the three stages side by side */
type StageView = LabStage | 0;
const STAGES: [StageView, string][] = [
  [1, '幼體'],
  [2, '成長'],
  [3, '完全體'],
  [0, '三階並排'],
];
const parseStage = (v: string | null): StageView => (v === 'all' ? 0 : v === '1' ? 1 : v === '2' ? 2 : 3);

const RARITY_ORDER = ['SSR', 'SR', 'R', 'N'] as const;
const INK = '#2a2231';

const VIEWS: [string, number][] = [
  ['正面', 0],
  ['四分之三', -0.72],
  ['側面', -Math.PI / 2],
  ['背面', Math.PI],
];

/** Wraps the in-game model as a LabModel: spirits not yet redone use it as the baseline, redone ones use it for comparison */
function gameModel(id: string, stage: LabStage): LabModel {
  const sp = SPIRITS.find((s) => s.id === id);
  const c = buildCreature(id, stage, sp?.rarity ?? 'R');
  c.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = !(m.material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial;
    m.receiveShadow = false;
  });
  c.update(0);
  c.root.updateMatrixWorld(true);
  const sphere = new THREE.Box3().setFromObject(c.root).getBoundingSphere(new THREE.Sphere());
  return {
    root: c.root,
    update: (t, dt) => {
      if (dt === 0) c.time = t;
      c.update(dt);
    },
    center: sphere.center,
    radius: sphere.radius * 0.92,
  };
}

/**
  * The three Breakthrough stages side by side (left to right: I, II, III); their height ratios match the game's TARGET, and each one turns on the spot by itself.
  * normalized: the model is already at game scale (the current in-game model), so no further scaling is needed.
 */
function lineup(make: (s: LabStage) => LabModel, rarity: string, normalized: boolean, blob: () => THREE.Mesh): LabModel {
  const root = new THREE.Group();
  const T = TARGET[rarity] ?? TARGET.R;
  const models = ([1, 2, 3] as const).map((s) => make(s));
  const hs = models.map((m) => labLocalHeight(m.root));
  const slots = models.map((m, i) => {
    const slot = new THREE.Group();
    const spin = new THREE.Group();
    spin.add(m.root);
    slot.add(spin, blob());
    slot.scale.setScalar(normalized ? 1 : (T[i] / T[2]) * (hs[2] / hs[i]));
    root.add(slot);
    const size = new THREE.Box3().setFromObject(m.root).getSize(new THREE.Vector3());
    return { spin, m, w: Math.max(size.x, size.z * 0.8) * slot.scale.x, slot };
  });
  const gap = 0.12 * hs[2];
  const total = slots.reduce((a, s) => a + s.w, 0) + gap * 2;
  let x = -total / 2;
  for (const s of slots) {
    s.slot.position.x = x + s.w / 2;
    x += s.w + gap;
  }
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    root,
    update: (t, dt) => {
      // The lab writes the turning onto root; side by side, each one turns on the spot instead
      const y = root.rotation.y;
      root.rotation.y = 0;
      for (const s of slots) {
        s.spin.rotation.y = y;
        s.m.update(t, dt);
      }
    },
    center,
    radius: Math.max(size.y * 0.6, size.x * 0.36),
  };
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.shared) return;
    m.geometry.dispose();
    for (const x of Array.isArray(m.material) ? m.material : [m.material]) x.dispose();
  });
}

/** Background: grey-blue at the top, lighter near the ground, so the character's pale stone has enough brightness contrast at head height */
function backdrop(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#93a6bd');
  gr.addColorStop(0.55, '#c3cdd9');
  gr.addColorStop(1, '#e4e7ea');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blobTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.45, 'rgba(0,0,0,0.6)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function runLab(el: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  el.style.cssText = 'position:fixed;inset:0;background:linear-gradient(#93a6bd,#c3cdd9 55%,#e4e7ea);overflow:hidden';

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = backdrop();

  // Key light: warm white from the upper front right, casts the shadow
  const key = new THREE.DirectionalLight(0xfff2de, 2.75);
  key.position.set(1.3, 2.9, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 5;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -1.4;
  sc.right = sc.top = 1.4;
  sc.near = 0.5;
  sc.far = 8;
  scene.add(key, key.target);
  // Spirit materials ignore scene lights: the key light direction is written into LIGHT; the lab does no tone mapping, so the inverse ACES is turned off
  LIGHT.dir.value.copy(key.position).normalize();
  SPIRIT_RIG.invAces.value = 0;
  // Sky light: cooler above, warm grey below, bounced up from the ground
  scene.add(new THREE.HemisphereLight(0xd6e4ff, 0xb3a58e, 0.95));

  // Ground: shadow only (the contact shadow is a soft round spot, with the key light's shadow laid over it)
  const shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ color: 0x3a3048, opacity: 0.2 }));
  shadowGround.rotation.x = -Math.PI / 2;
  shadowGround.receiveShadow = true;
  scene.add(shadowGround);
  const blobGeo = new THREE.PlaneGeometry(1.35, 1.75);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x3a3048, transparent: true, opacity: 0.32, depthWrite: false });
  const makeBlob = () => {
    const b = new THREE.Mesh(blobGeo, blobMat);
    b.rotation.x = -Math.PI / 2;
    b.position.y = 0.002;
    b.userData.shared = true;
    return b;
  };
  const blob = makeBlob();
  scene.add(blob);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
  const miniCam = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
  const elev = THREE.MathUtils.degToRad(11);

  // ── The spirit being viewed ──
  // A spirit id, or a lab-only model (map character char_<look>)
  const validId = (id: string | null) => (id && (SPIRITS.some((s) => s.id === id) || id in LAB_MODELS) ? id : Object.keys(LAB_MODELS)[0]);
  let id = validId(params.get('lab'));
  let old = params.has('old') || !LAB_MODELS[id];
  let stage = parseStage(params.get('stage'));
  const rarityOf = (sid: string) => SPIRITS.find((s) => s.id === sid)?.rarity ?? 'R';
  /** Triangle budget: SSR spirits of about 60,000 triangles such as Nef and Astra still hold 60 fps with two on the field in battle; the lower the rarity, the smaller on screen, the smaller the budget */
  const TRI_BUDGET: Record<string, number> = { SSR: 60000, SR: 45000, R: 35000, N: 25000 };
  // Mesh count (draw calls): about twenty N / R / SR spirits are on screen at once in the field, and each mesh is drawn one more time for normals
  const MESH_BUDGET: Record<string, number> = { SSR: 100, SR: 60, R: 50, N: 40 };
  const build = (): LabModel => {
    const one = (s: LabStage) => (old ? gameModel(id, s) : LAB_MODELS[id](s));
    return stage === 0 ? lineup(one, rarityOf(id), old, makeBlob) : one(stage);
  };
  // Action weights: &act=roar:1,wake:1
  const actParam = (params.get('act') ?? '').split(',').map((kv) => kv.split(':')).filter(([k, v]) => k && v !== undefined);
  const applyAct = (m: LabModel) => {
    if (m.act) for (const [k, v] of actParam) if (k in m.act) m.act[k] = Number(v);
    return m;
  };
  let model: LabModel = applyAct(build());
  scene.add(model.root);
  blob.visible = stage !== 0;

  const aimCamera = (cam: THREE.PerspectiveCamera, aspect: number, fill: number) => {
    cam.aspect = aspect;
    // The character's bounding sphere has to fit entirely within the narrower side
    const vfov = THREE.MathUtils.degToRad(cam.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const dist = model.radius / Math.sin(Math.min(vfov, hfov) / 2) / fill;
    cam.position.set(model.center.x, model.center.y + Math.sin(elev) * dist, model.center.z + Math.cos(elev) * dist);
    cam.lookAt(model.center);
    cam.updateProjectionMatrix();
  };

  const ink = new InkPipeline(renderer);
  const miniInk = new InkPipeline(renderer);
  let W = 1;
  let H = 1;
  let pr = 1;
  const MINI = 150;
  const resize = () => {
    W = el.clientWidth || innerWidth;
    H = el.clientHeight || innerHeight;
    // Cap the supersampled total at about 5 million pixels; on high-resolution screens pixelRatio is lowered a little automatically
    const cap = Math.sqrt(5.0e6 / (W * H)) / SUPERSAMPLE;
    pr = Math.max(1, Math.min(devicePixelRatio || 1, cap));
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    ink.setSize(Math.round(W * pr), Math.round(H * pr), pr);
    miniInk.setSize(Math.round(MINI * pr), Math.round(MINI * pr), pr);
    aimCamera(camera, W / H, 0.82);
    aimCamera(miniCam, 1, 0.9);
  };
  resize();
  addEventListener('resize', resize);

  // ── State ──
  const yawParam = params.get('yaw');
  let auto = yawParam === null;
  let yaw = yawParam !== null ? Number(yawParam) : -0.72;
  let sweepT = 0;
  let mini = params.has('mini');
  ink.silhouette = params.has('sil');
  miniInk.silhouette = false;
  const tParam = params.get('t');
  let frozen: number | null = tParam !== null ? Number(tParam) : null;

  // Drag to turn
  let drag: { x: number; yaw: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, yaw };
    auto = false;
    renderer.domElement.style.cursor = 'grabbing';
    renderer.domElement.setPointerCapture(e.pointerId);
    syncUi();
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
  });
  const endDrag = () => {
    drag = null;
    renderer.domElement.style.cursor = 'grab';
  };
  renderer.domElement.addEventListener('pointerup', endDrag);
  renderer.domElement.addEventListener('pointercancel', endDrag);

  // ── UI: title at top left, spirit list on the left, a row of view angles and check toggles at the bottom ──
  const ui = document.createElement('div');
  ui.style.cssText = 'position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;gap:6px;flex-wrap:wrap;padding:0 16px;font:600 13px/1 system-ui,sans-serif;pointer-events:none';
  const title = document.createElement('div');
  title.style.cssText = `position:absolute;left:16px;top:14px;font:700 15px/1.3 system-ui,sans-serif;color:${INK};letter-spacing:.04em;pointer-events:none`;
  // Frame and label of the shrunken preview (the preview itself is drawn on the WebGL canvas)
  const miniFrame = document.createElement('div');
  miniFrame.style.cssText = `position:absolute;right:16px;bottom:60px;width:${MINI}px;height:${MINI}px;border:2px solid ${INK};border-radius:6px;pointer-events:none;box-sizing:border-box`;
  miniFrame.innerHTML = `<span style="position:absolute;left:-2px;top:-22px;font:600 12px/1 system-ui,sans-serif;color:${INK}">縮小預覽 150px</span>`;

  // Spirit list: grouped by rarity, redone ones tagged "Lab version"; a box at the top filters by name or id
  const panel = document.createElement('div');
  panel.style.cssText = `position:absolute;left:16px;top:64px;bottom:64px;width:216px;display:flex;flex-direction:column;background:rgba(255,255,255,.72);border-radius:10px;box-shadow:0 2px 10px rgba(42,34,49,.12);font:500 13px/1.2 system-ui,sans-serif;color:${INK};overflow:hidden`;
  const done = SPIRITS.filter((s) => LAB_MODELS[s.id]).length;
  const head = document.createElement('div');
  head.style.cssText = 'padding:10px 12px 8px;display:flex;flex-direction:column;gap:7px;border-bottom:1px solid rgba(42,34,49,.12)';
  head.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:14px">精靈清單</b><span style="font-size:12px;opacity:.7">實驗版 ${done}／${SPIRITS.length}</span></div>`;
  const filter = document.createElement('input');
  filter.placeholder = '名稱或 id';
  filter.style.cssText = `border:1px solid rgba(42,34,49,.2);border-radius:6px;padding:6px 8px;font:inherit;color:${INK};background:rgba(255,255,255,.85);outline:none`;
  head.appendChild(filter);
  const list = document.createElement('div');
  list.style.cssText = 'flex:1;overflow-y:auto;padding:4px 6px 10px';
  panel.append(head, list);

  const order = RARITY_ORDER.flatMap((r) => SPIRITS.filter((s) => s.rarity === r));
  const rows = new Map<string, HTMLButtonElement>();
  const groups: { label: HTMLDivElement; ids: string[] }[] = [];
  for (const r of RARITY_ORDER) {
    const members = order.filter((s) => s.rarity === r);
    const label = document.createElement('div');
    label.textContent = `${r}　${members.length} 隻`;
    label.style.cssText = 'padding:10px 6px 4px;font-size:11px;font-weight:700;letter-spacing:.08em;opacity:.55';
    list.appendChild(label);
    groups.push({ label, ids: members.map((s) => s.id) });
    for (const s of members) {
      const b = document.createElement('button');
      b.style.cssText = 'display:flex;width:100%;align-items:center;justify-content:space-between;gap:6px;border:0;border-radius:6px;padding:6px 8px;margin:1px 0;cursor:pointer;font:inherit;text-align:left;transition:background .12s';
      const tag = LAB_MODELS[s.id]
        ? `<span style="flex:none;font-size:11px;font-weight:700;padding:2px 6px;border-radius:999px;background:#e2ad48;color:${INK}">實驗版</span>`
        : '';
      b.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</span>${tag}`;
      b.title = s.id;
      b.onclick = () => pick(s.id, false);
      list.appendChild(b);
      rows.set(s.id, b);
    }
  }
  // Map characters: not spirits, a separate group placed last
  const chars = Object.keys(LAB_MODELS).filter((k) => !SPIRITS.some((sp) => sp.id === k));
  if (chars.length) {
    const label = document.createElement('div');
    label.textContent = `人物　${chars.length} 個`;
    label.style.cssText = 'padding:10px 6px 4px;font-size:11px;font-weight:700;letter-spacing:.08em;opacity:.55';
    list.appendChild(label);
    for (const cid of chars) {
      const b = document.createElement('button');
      b.style.cssText = 'display:flex;width:100%;align-items:center;border:0;border-radius:6px;padding:6px 8px;margin:1px 0;cursor:pointer;font:inherit;text-align:left;transition:background .12s';
      b.textContent = CHAR_LAB_NAMES[cid] ?? cid;
      b.title = cid;
      b.onclick = () => pick(cid, false);
      list.appendChild(b);
      rows.set(cid, b);
    }
  }
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    for (const g of groups) {
      let any = false;
      for (const sid of g.ids) {
        const s = SPIRITS.find((x) => x.id === sid)!;
        const hit = !q || sid.includes(q) || s.name.toLowerCase().includes(q) || s.en.toLowerCase().includes(q);
        rows.get(sid)!.style.display = hit ? 'flex' : 'none';
        any ||= hit;
      }
      g.label.style.display = any ? 'block' : 'none';
    }
  });
  // While typing in the list, arrow keys and shortcuts must not steal the input
  filter.addEventListener('keydown', (e) => e.stopPropagation());

  // Three stages side by side need the full width, so the list starts collapsed
  let showList = innerWidth >= 900 && stage !== 0;
  el.append(title, panel, ui, miniFrame);

  const btns: { b: HTMLButtonElement; on: () => boolean; show?: () => boolean }[] = [];
  const button = (label: string | (() => string), onClick: () => void, on: () => boolean, show?: () => boolean) => {
    const b = document.createElement('button');
    b.style.cssText = 'pointer-events:auto;border:0;border-radius:999px;padding:9px 14px;cursor:pointer;font:inherit;transition:background .15s';
    b.onclick = () => {
      onClick();
      syncUi();
    };
    ui.appendChild(b);
    const text = typeof label === 'string' ? () => label : label;
    btns.push({ b, on, show: () => ((b.textContent = text()), show ? show() : true) });
  };
  button('清單', () => (showList = !showList), () => showList);
  const near = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.01;
  for (const [label, v] of VIEWS) button(label, () => ((yaw = v), (auto = false)), () => !auto && near(yaw, v));
  // When auto turning restarts, continue from the current angle
  const resumeSweep = () => (sweepT = (Math.asin(THREE.MathUtils.clamp((yaw + 0.72) / 0.9, -1, 1)) / (Math.PI * 2)) * 18);
  button('自動轉向', () => ((auto = !auto), resumeSweep()), () => auto);
  button('剪影', () => (ink.silhouette = !ink.silhouette), () => ink.silhouette);
  button('縮小檢查', () => (mini = !mini), () => mini);
  button('對照遊戲現版', () => pick(id, !old), () => old, () => !!LAB_MODELS[id] && SPIRITS.some((sp) => sp.id === id));
  for (const [s, label] of STAGES) button(label, () => pick(id, old, s), () => stage === s);

  const syncUi = () => {
    const sp = SPIRITS.find((x) => x.id === id);
    const name = sp ? sp.name : (CHAR_LAB_NAMES[id] ?? id);
    const sub = !old
      ? '造型實驗：MeshToon 三至四階＋後製描邊＋1.5 倍超取樣'
      : LAB_MODELS[id]
        ? '遊戲現版（對照用）：舊卡通材質＋背面描邊'
        : '遊戲現版（尚未重做，當作基準圖）：舊卡通材質＋背面描邊';
    title.innerHTML = `${name}<br><span style="font-weight:500;font-size:12px;opacity:.7">${sub}</span>`;
    panel.style.display = showList ? 'flex' : 'none';
    miniFrame.style.display = mini ? 'block' : 'none';
    for (const { b, on, show } of btns) {
      b.style.display = show && !show() ? 'none' : 'inline-block';
      const a = on();
      b.style.background = a ? INK : 'rgba(255,255,255,.78)';
      b.style.color = a ? '#f4efe4' : INK;
    }
    for (const [sid, b] of rows) {
      const cur = sid === id;
      b.style.background = cur ? INK : 'transparent';
      b.style.color = cur ? '#f4efe4' : INK;
    }
  };

  /** Switch to another spirit (or the lab version / in-game model of the same one); the URL changes with it, so a refresh stays on the same one */
  function pick(next: string, wantOld: boolean, nextStage: StageView = stage): void {
    next = validId(next);
    const nextOld = wantOld || !LAB_MODELS[next];
    if (next === id && nextOld === old && nextStage === stage) return;
    scene.remove(model.root);
    disposeTree(model.root);
    id = next;
    old = nextOld;
    if (nextStage === 0 && stage !== 0) showList = false;
    stage = nextStage;
    model = applyAct(build());
    scene.add(model.root);
    blob.visible = stage !== 0;
    aimCamera(camera, W / H, 0.82);
    aimCamera(miniCam, 1, 0.9);
    const q = new URLSearchParams(location.search);
    q.set('lab', id);
    if (old && LAB_MODELS[id]) q.set('old', '');
    else q.delete('old');
    if (stage !== 3) q.set('stage', stage === 0 ? 'all' : String(stage));
    else q.delete('stage');
    history.replaceState(null, '', `${location.pathname}?${q.toString().replace(/=(?=&|$)/g, '')}`);
    syncUi();
    rows.get(id)?.scrollIntoView({ block: 'nearest' });
  }

  // Keyboard: ↑↓ switch to the previous / next one in list order (while filtering, only among the matches)
  addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const visible = order.filter((s) => rows.get(s.id)!.style.display !== 'none').map((s) => s.id);
    if (!visible.length) return;
    const i = visible.indexOf(id);
    const j = i < 0 ? 0 : (i + (e.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length;
    e.preventDefault();
    pick(visible[j], false);
  });
  syncUi();
  rows.get(id)?.scrollIntoView({ block: 'nearest' });

  (window as unknown as { __lab: object }).__lab = {
    pick: (next: string, wantOld = false, s?: StageView) => pick(next, wantOld, s),
    stage: (s: StageView) => pick(id, old, s),
    yaw: (v: number) => ((yaw = v), (auto = false), syncUi()),
    auto: (on: boolean) => ((auto = on), syncUi()),
    sil: (on: boolean) => ((ink.silhouette = on), syncUi()),
    mini: (on: boolean) => ((mini = on), syncUi()),
    freeze: (t: number | null) => (frozen = t),
    /** Triangle and mesh counts, and the triangle budget for the rarity (two on the field in battle plus the outline's second draw pass go over the budget and drop frames) */
    stats: () => {
      let tris = 0;
      let meshes = 0;
      model.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible) return;
        meshes++;
        const g = m.geometry;
        tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
      });
      return { tris: Math.round(tris), meshes, budget: TRI_BUDGET[rarityOf(id)] ?? TRI_BUDGET.R, meshBudget: MESH_BUDGET[rarityOf(id)] ?? MESH_BUDGET.R };
    },
    /** One line per mesh: parent depth, material name, inkGroup, triangle count (to see which stray ones remain when cutting the mesh count) */
    parts: () => {
      const out: string[] = [];
      model.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible) return;
        let d = 0;
        for (let p = m.parent; p && p !== model.root; p = p.parent) d++;
        const mat = Array.isArray(m.material) ? 'multi' : m.material.name || m.material.type;
        const g = m.geometry;
        out.push(`${d} ${mat} ${m.userData.inkGroup ?? '-'} ${Math.round((g.index ? g.index.count : g.attributes.position.count) / 3)}`);
      });
      return out;
    },
  };

  // ── Main loop: the first frame is drawn right after the scene is built, so there is never a blank screen ──
  let t = 0;
  let last = performance.now();
  const miniView = new THREE.Vector4();
  const frame = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (auto) {
      sweepT += dt;
      // Sweep back and forth around the three-quarter front, about 18 s per pass, so both the side and the front are seen
      yaw = -0.72 + Math.sin((sweepT / 18) * Math.PI * 2) * 0.9;
    }
    model.root.rotation.y = yaw;
    model.update(frozen ?? t, frozen !== null ? 0 : dt);
    model.root.updateMatrixWorld();
    updateRim(camera);
    ink.render(scene, camera);
    if (mini) {
      const pad = 16 * pr;
      miniView.set(Math.round(W * pr - MINI * pr - pad), Math.round(pad + 44 * pr), Math.round(MINI * pr), Math.round(MINI * pr));
      updateRim(miniCam);
      miniInk.render(scene, miniCam, miniView);
    }
  };
  frame();
  renderer.setAnimationLoop(frame);
}
