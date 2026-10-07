// Plugs the lab models built under ?lab into the game: a Creature wraps them (root → scaler → pose → body → model),
// so battles, ultimates, the opening, summons, the codex and menus keep operating on a Creature without knowing the model inside was swapped.
// The material is labToon from lab/toonKit.ts (it takes LIGHT and has the white flash, fade-out and corruption parameters), and the meshes already enable the outline layer, so render/ink.ts draws their lines.
// Before switching a spirit over, check which parts of the old model the ultimate and the other cinematics rely on (anchors, glowing parts, wings), spell out the impact, then add it to PORTED.

import * as THREE from 'three';
import { Creature } from './creature.ts';
import { CHAR_LAB_BUILDERS } from './field/avatarLab.ts';
import { registerInkRoot } from './ink.ts';
import { buildAcornsquirrelLab } from './lab/acornsquirrelModel.ts';
import { buildAbyssjellyLab } from './lab/abyssjellyModel.ts';
import { buildAerothLab } from './lab/aerothModel.ts';
import { buildAstragateLab } from './lab/astragateModel.ts';
import { buildBallsparkLab } from './lab/ballsparkModel.ts';
import { buildBalancescaleLab } from './lab/balancescaleModel.ts';
import { buildBanyanelderLab } from './lab/banyanelderModel.ts';
import { buildBubblecrabLab } from './lab/bubblecrabModel.ts';
import { buildBellowsbeastLab } from './lab/bellowsbeastModel.ts';
import { buildCandledoveLab } from './lab/candledoveModel.ts';
import { buildChimeSpriteLab } from './lab/chime_spriteModel.ts';
import { buildChronodragonLab } from './lab/chronodragonModel.ts';
import { buildClockmouseLab } from './lab/clockmouseModel.ts';
import { buildCloudfluffLab } from './lab/cloudfluffModel.ts';
import { buildDandelionLab } from './lab/dandelionModel.ts';
import { buildDigmoleLab } from './lab/digmoleModel.ts';
import { buildDreamcapLab } from './lab/dreamcapModel.ts';
import { buildEclipseBatlordLab } from './lab/eclipse_batlordModel.ts';
import { buildEldarinLab } from './lab/eldarinModel.ts';
import { buildGaleWeaselLab } from './lab/gale_weaselModel.ts';
import { buildGargoyleLab } from './lab/gargoyleModel.ts';
import { buildGriffinLab } from './lab/griffinModel.ts';
import { buildHedgehogLab } from './lab/hedgehogModel.ts';
import { buildGrimoireLab } from './lab/grimoireModel.ts';
import { buildElderwoodWardenLab } from './lab/elderwood_wardenModel.ts';
import { buildIcecrownLab } from './lab/icecrownModel.ts';
import { buildIgnisarLab } from './lab/ignisarModel.ts';
import { buildInkcatLab } from './lab/inkcatModel.ts';
import { buildLanternfishLab } from './lab/lanternfishModel.ts';
import { buildLeaffrogLab } from './lab/leaffrogModel.ts';
import { buildLuminaelLab } from './lab/luminaelModel.ts';
import { buildLyrebirdLab } from './lab/lyrebirdModel.ts';
import { buildMagmaGolemLab } from './lab/magma_golemModel.ts';
import { buildMonolithLab } from './lab/monolithModel.ts';
import { buildMaskfoxLab } from './lab/maskfoxModel.ts';
import { buildNoxfangLab } from './lab/noxfangModel.ts';
import { buildOathseaSageLab } from './lab/oathsea_sageModel.ts';
import { buildPapercraneLab } from './lab/papercraneModel.ts';
import { buildPhoenixLab } from './lab/phoenixModel.ts';
import { buildPyrewingLab } from './lab/pyrewingModel.ts';
import { buildSandReaperLab } from './lab/sand_reaperModel.ts';
import { buildSandserpentLab } from './lab/sandserpentModel.ts';
import { buildOwlarchivistLab } from './lab/owlarchivistModel.ts';
import { buildPrismsnailLab } from './lab/prismsnailModel.ts';
import { buildPyreDragoonLab } from './lab/pyre_dragoonModel.ts';
import { buildRhinoLab } from './lab/rhinoModel.ts';
import { buildRelicBladeLab } from './lab/relic_bladeModel.ts';
import type { LabBuilder, LabStage } from './lab/shapes.ts';
import { buildShieldbeetleLab } from './lab/shieldbeetleModel.ts';
import { buildSirenLab } from './lab/sirenModel.ts';
import { buildSkyreignLab } from './lab/skyreignModel.ts';
import { buildSoulLanternLab } from './lab/soul_lanternModel.ts';
import { buildSpringlotusLab } from './lab/springlotusModel.ts';
import { buildSteameelLab } from './lab/steameelModel.ts';
import { buildStormramLab } from './lab/stormramModel.ts';
import { buildStormhorseLab } from './lab/stormhorseModel.ts';
import { buildSwordfishLab } from './lab/swordfishModel.ts';
import { buildSylvaronLab } from './lab/sylvaronModel.ts';
import { buildTerragonLab } from './lab/terragonModel.ts';
import { buildThalasseneLab } from './lab/thalasseneModel.ts';
import { buildTornadoLab } from './lab/tornadoModel.ts';
import { buildThunderbirdLab } from './lab/thunderbirdModel.ts';
import { buildTombhoundLab } from './lab/tombhoundModel.ts';
import { buildVoidchildLab } from './lab/voidchildModel.ts';
import { buildVoltadilloLab } from './lab/voltadilloModel.ts';
import { buildVoltarionLab } from './lab/voltarionModel.ts';
import { buildWeaverspiderLab } from './lab/weaverspiderModel.ts';
import type { SpiritMaterial } from './spiritToon.ts';

/** Spirits that have a lab model: to add one, write a builder in src/render/lab/<id>Model.ts and register it here (?lab and the game share this table) */
export const LAB_BUILDERS: Record<string, LabBuilder> = {
  astragate: buildAstragateLab,
  voidchild: buildVoidchildLab,
  noxfang: buildNoxfangLab,
  ignisar: buildIgnisarLab,
  thalassene: buildThalasseneLab,
  voltarion: buildVoltarionLab,
  terragon: buildTerragonLab,
  sylvaron: buildSylvaronLab,
  luminael: buildLuminaelLab,
  eldarin: buildEldarinLab,
  chronodragon: buildChronodragonLab,
  aeroth: buildAerothLab,
  leaffrog: buildLeaffrogLab,
  skyreign: buildSkyreignLab,
  dandelion: buildDandelionLab,
  dreamcap: buildDreamcapLab,
  weaverspider: buildWeaverspiderLab,
  phoenix: buildPhoenixLab,
  griffin: buildGriffinLab,
  siren: buildSirenLab,
  tornado: buildTornadoLab,
  sandserpent: buildSandserpentLab,
  thunderbird: buildThunderbirdLab,
  cloudfluff: buildCloudfluffLab,
  acornsquirrel: buildAcornsquirrelLab,
  owlarchivist: buildOwlarchivistLab,
  bubblecrab: buildBubblecrabLab,
  swordfish: buildSwordfishLab,
  pyre_dragoon: buildPyreDragoonLab,
  elderwood_warden: buildElderwoodWardenLab,
  icecrown: buildIcecrownLab,
  springlotus: buildSpringlotusLab,
  lanternfish: buildLanternfishLab,
  steameel: buildSteameelLab,
  pyrewing: buildPyrewingLab,
  digmole: buildDigmoleLab,
  oathsea_sage: buildOathseaSageLab,
  abyssjelly: buildAbyssjellyLab,
  bellowsbeast: buildBellowsbeastLab,
  papercrane: buildPapercraneLab,
  lyrebird: buildLyrebirdLab,
  candledove: buildCandledoveLab,
  stormram: buildStormramLab,
  sand_reaper: buildSandReaperLab,
  gale_weasel: buildGaleWeaselLab,
  shieldbeetle: buildShieldbeetleLab,
  monolith: buildMonolithLab,
  eclipse_batlord: buildEclipseBatlordLab,
  gargoyle: buildGargoyleLab,
  prismsnail: buildPrismsnailLab,
  voltadillo: buildVoltadilloLab,
  rhino: buildRhinoLab,
  hedgehog: buildHedgehogLab,
  ballspark: buildBallsparkLab,
  tombhound: buildTombhoundLab,
  clockmouse: buildClockmouseLab,
  stormhorse: buildStormhorseLab,
  balancescale: buildBalancescaleLab,
  maskfox: buildMaskfoxLab,
  inkcat: buildInkcatLab,
  relic_blade: buildRelicBladeLab,
  magma_golem: buildMagmaGolemLab,
  chime_sprite: buildChimeSpriteLab,
  soul_lantern: buildSoulLanternLab,
  banyanelder: buildBanyanelderLab,
  grimoire: buildGrimoireLab,
  // Map characters (protagonist, residents, people in the prologue): char_<look>
  ...CHAR_LAB_BUILDERS,
};

/** Spirits already ported into the game: add one here and that spirit uses the new model in every scene */
export const PORTED = new Set<string>([
  'astragate',
  'voltarion',
  'terragon',
  'noxfang',
  'aeroth',
  'voidchild',
  'sylvaron',
  'leaffrog',
  'chronodragon',
  'ignisar',
  'thalassene',
  'eldarin',
  'luminael',
  'skyreign',
  'dandelion',
  'dreamcap',
  'weaverspider',
  'phoenix',
  'griffin',
  'siren',
  'tornado',
  'sandserpent',
  'thunderbird',
  'cloudfluff',
  'acornsquirrel',
  'owlarchivist',
  'bubblecrab',
  'swordfish',
  'pyre_dragoon',
  'elderwood_warden',
  'icecrown',
  'springlotus',
  'lanternfish',
  'steameel',
  'pyrewing',
  'digmole',
  'oathsea_sage',
  'abyssjelly',
  'bellowsbeast',
  'papercrane',
  'lyrebird',
  'candledove',
  'stormram',
  'sand_reaper',
  'gale_weasel',
  'shieldbeetle',
  'monolith',
  'eclipse_batlord',
  'gargoyle',
  'prismsnail',
  'voltadillo',
  'rhino',
  'hedgehog',
  'ballspark',
  'tombhound',
  'clockmouse',
  'stormhorse',
  'balancescale',
  'maskfox',
  'inkcat',
  'relic_blade',
  'magma_golem',
  'chime_sprite',
  'soul_lantern',
  'banyanelder',
  'grimoire',
]);

export function isPorted(id: string): boolean {
  return PORTED.has(id) && id in LAB_BUILDERS;
}

/** For dev pages: &port=a,b ports them temporarily, &port=all ports everything, &port=off reverts everything to the old models */
export function applyPortParam(q: URLSearchParams): void {
  const v = q.get('port');
  if (v === 'off') PORTED.clear();
  else if (v === 'all') for (const id of Object.keys(LAB_BUILDERS)) PORTED.add(id);
  else if (v) for (const id of v.split(',')) if (id) PORTED.add(id);
}
// Every page (the game itself, summon, the opening) honors the URL's &port, so before/after comparison needs no per-dev-page handling
if (typeof location !== 'undefined') applyPortParam(new URLSearchParams(location.search));

/**
 * Height used to normalize the model: take the top (a floating model counts its height above the ground), and a wide body counts as 0.7 of its length or 0.6 of its width.
 * root must have no parent yet, or a parent with no transform.
 */
export function labLocalHeight(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return Math.max(0.2, box.max.y, size.z * 0.7, size.x * 0.6);
}

/** Build a Creature from a lab model. target is the normalized height (the same TARGET table as the old models) */
export function buildLabCreature(id: string, stage: LabStage, target: number): Creature {
  const c = new Creature();
  const m = LAB_BUILDERS[id](stage);
  c.lab = m;
  c.ink = true;
  c.body.add(m.root);

  // Materials: spirit materials go into mats (white flash, fade-out, corruption); other materials (eye highlights, custom starfield) fade by scaling their original opacity proportionally
  const others = new Map<THREE.Material, { transparent: boolean; opacity: number; uOpacity?: number }>();
  m.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if ((mat as SpiritMaterial).isSpiritMaterial) {
        if (!c.mats.includes(mat as SpiritMaterial)) c.mats.push(mat as SpiritMaterial);
      } else if (!others.has(mat)) {
        const u = (mat as THREE.ShaderMaterial).uniforms?.uOpacity;
        others.set(mat, { transparent: mat.transparent, opacity: mat.opacity, uOpacity: u ? (u.value as number) : undefined });
      }
    }
  });
  if (others.size)
    c.fadeHooks.push((o) => {
      for (const [mat, base] of others) {
        mat.transparent = base.transparent || o < 1;
        mat.opacity = base.opacity * o;
        const u = (mat as THREE.ShaderMaterial).uniforms?.uOpacity;
        if (u && base.uOpacity !== undefined) u.value = base.uOpacity * o;
      }
    });

  // White flash and silhouette: non-spirit materials such as eye highlights and gems also change color, so the summon and portrait silhouettes come out fully black
  const tints: { col: THREE.Color; base: THREE.Color; dim?: boolean }[] = [];
  for (const mat of others.keys()) {
    const col = (mat as THREE.MeshBasicMaterial).color ?? ((mat as THREE.ShaderMaterial).uniforms?.uColor?.value as THREE.Color | undefined);
    if (col?.isColor) tints.push({ col, base: col.clone() });
    const em = (mat as THREE.MeshStandardMaterial).emissive;
    if (em?.isColor) tints.push({ col: em, base: em.clone(), dim: true });
  }
  let lastAmt = 0;
  if (tints.length)
    c.flashHooks.push((f, amt) => {
      if (amt === 0 && lastAmt === 0) return;
      lastAmt = amt;
      for (const t of tints) {
        t.col.copy(t.base);
        if (t.dim) t.col.multiplyScalar(1 - amt);
        else t.col.lerp(f, amt);
      }
    });

  // Anchors: the head and eyes are used for framing and eye glints; with no head anchor, head is not attached and the battle scene falls back to 75% of the height
  const rig = m.rig ?? {};
  if (rig.head) c.head = rig.head as THREE.Group;
  c.eyes = (rig.eyes ?? []) as THREE.Group[];
  c.anchors = { ...(rig.anchors ?? {}) };
  registerInkRoot(c.root);

  // Normalize size
  c.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m.root);
  const size = box.getSize(new THREE.Vector3());
  const top = Math.max(0.2, box.max.y);
  const scale = target / labLocalHeight(m.root);
  c.scaler.scale.setScalar(scale);
  c.height = top;
  c.width = Math.max(size.x, size.z) * scale;
  c.worldHeight = top * scale;
  c.groundGap = Math.max(0, box.min.y) * scale;
  c.archetype = box.min.y > top * 0.15 ? 'float' : 'quad';
  return c;
}
