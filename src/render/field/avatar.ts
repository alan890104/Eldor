// Characters on the map: the hero (Pactbearer), the residents of each region, and Elda, the child and the masked figure in the prologue.
// Chibi proportions (the head is about 40% of the height, short body and short legs), and every part is thick geometry:
// the hair is a base shell hugging the head with bulky locks piled on top,
// clothes are layered shells (top, skirt hem, vest, robe, cape), hands have four fingers and a thumb, and boots have soles,
// heels, turned-down cuffs and straps.
// Small parts are made at the same level of detail as the spirit models: buckles with a frame and prong, belt loops,
// buttons with a rim, seams, piping, pocket flaps, diagonal creases in sleeves and trouser legs, gathers on the belt.
// The head shape is the skull of KayKit Character Pack: Adventurers (CC0) (sampled into headData.ts by tools/headgrid.mjs):
// a rounded block, a slightly flat face front,
// the jaw tapering to the chin, a full back of the head, plus KayKit's nose (thick geometry) and bowl-shaped ears.
// The face follows KayKit's language, with flat shapes laid on the head shape: small deep upright-oval eyes (nearly black,
// one small highlight), no whites, lashes or blush; short thick brows; a small mouth.
// Expressions are always lively: the eyes fully open, no drooping lids; personality is told apart by brow angle and height,
// how flat the eyes are, mouth shape and posture.
// The material is sceneMaterial (MeshToon), and outlines are marked with inkScenery for ink.ts's post-process outline;
// once built, mergePerson bakes the parts under the same joint
// into vertex colors and merges them into one mesh (face shapes and eye highlights merged separately), about 15 draw calls per person.
// Motion: when walking the legs have knees and the arms have elbows, the body bobs and twists at the waist,
// and the cape and hair tips stream backward; when standing it breathes, shifts weight side to side,
// now and then turns its head to look aside, and blinks.
// The public interface is unchanged (Outfit, playerOutfit, npcOutfit, and Avatar's hips / torso / legs / arms / cape /
// tails / speed / air / wave / update),
// with fores, shins, hands, restPose() and foreheadLocal added for posing in the prologue.

import * as THREE from 'three';
import { Creature } from '../creature.ts';
import type { NpcLook } from '../../game/campaign.ts';
import { brilliant, outline, rbox, slab } from '../lab/shapes.ts';
import { sceneMaterial, type SpiritMaterial } from '../spiritToon.ts';
import { angleCurve, capShell, type CapOpts, ellipse, fallBy, fallInBy, group, hairLocks, HeadShape, handGeo, inkPerson, type Lock, Mats, mergePerson, mergeStatic, part, PI, revShell, revSolid, roundEnds, shellGrid, smoothstep, stroke, tube, v3, type Role, type V3 } from './avatarKit.ts';
import { blendIntoFace, centerOf, type KKLook, kaykitEye, kaykitHairOff, kaykitOff, kaykitPart, onFace, slantOf } from './kaykitHead.ts';

export type HairStyle = 'messy' | 'short' | 'twintails' | 'bob' | 'long' | 'elder' | 'tied' | 'none';
export type FaceKind = 'bright' | 'cheer' | 'kind' | 'stern' | 'calm' | 'none';
export type Coat = 'tunic' | 'blouse' | 'vest' | 'robe' | 'armor' | 'plate' | 'shirt' | 'coat' | 'wrap' | 'gown';
export type Legwear = 'pants' | 'shorts' | 'skirt';
export type CapeKind = 'long' | 'capelet' | 'shawl' | 'cloak';
export type Extra = 'scarf' | 'glasses' | 'circlet' | 'mask' | 'neckerchief' | 'beads' | 'strap';

export interface Outfit {
  skin: number;
  hair: number;
  eye: number;
  top: number;
  topDark: number;
  bottom: number;
  boots: number;
  cape?: number;
  trim: number;
  /**
   * What it carries: pact is the Pactbearer's pouch for pact stones (with the pact mark on the back of the hand),
   * notebook is a research notebook, the rest are literal
   */
  gear?: 'sword' | 'staff' | 'spear' | 'book' | 'lantern' | 'none' | 'pact' | 'notebook';
  hat?: 'none' | 'hood' | 'helm' | 'band' | 'wizard' | 'twintails' | 'beard';
  /** Overall scale (children are smaller; the head is relatively larger) */
  scale?: number;
  /** All of the following are optional, with a default derived from hat */
  hairStyle?: HairStyle;
  face?: FaceKind;
  coat?: Coat;
  legwear?: Legwear;
  capeKind?: CapeKind;
  /** helm styles: kettle is a wide-brim iron helmet, sallet is a knight's helmet (with a plume) */
  helm?: 'kettle' | 'sallet';
  extras?: Extra[];
  /** Brow shape: fine is a thin curved brow (Mila, Elda); the default is a short thick brow */
  brows?: 'fine';
  /** Scarf color */
  scarf?: number;
}

const OUTFITS: Record<NpcLook, Outfit> = {
  mila: { skin: 0xffe0cc, hair: 0xff8fb0, eye: 0x7a4ad8, top: 0xfff2f6, topDark: 0xf0b8cc, bottom: 0xe46a9a, boots: 0x7a3a5a, trim: 0xffd36a, cape: 0xb07ad8, gear: 'notebook', hat: 'twintails', hairStyle: 'twintails', face: 'cheer', coat: 'blouse', legwear: 'skirt', capeKind: 'capelet', brows: 'fine' },
  villager: { skin: 0xf6d2b4, hair: 0x6a4a32, eye: 0x3a6a3a, top: 0x8ab86a, topDark: 0x5e8a4a, bottom: 0x7a5a3a, boots: 0x4a3222, trim: 0xe8d8a8, gear: 'none', hat: 'none', hairStyle: 'short', face: 'kind', coat: 'vest', extras: ['neckerchief'] },
  elder: { skin: 0xf0ccb0, hair: 0xe8e4dc, eye: 0x4a4a6a, top: 0x6a5a8a, topDark: 0x4a3e66, bottom: 0x5a4a72, boots: 0x3a2e40, trim: 0xd8c07a, gear: 'staff', hat: 'beard', hairStyle: 'elder', face: 'kind', coat: 'robe' },
  guard: { skin: 0xf2c8a8, hair: 0x4a3222, eye: 0x3a3a3a, top: 0x8a8a9a, topDark: 0x5e5e70, bottom: 0x4a4a5a, boots: 0x2e2a30, trim: 0xc89a4a, gear: 'spear', hat: 'helm', helm: 'kettle', hairStyle: 'short', face: 'stern', coat: 'armor' },
  kid: { skin: 0xffdcc4, hair: 0xd8903a, eye: 0x3a7ad8, top: 0xf2c84a, topDark: 0xc89a2a, bottom: 0x4a7ac8, boots: 0x6a3a2a, trim: 0xffffff, gear: 'none', hat: 'none', scale: 0.72, hairStyle: 'messy', face: 'cheer', coat: 'shirt', legwear: 'shorts' },
  scholar: { skin: 0xf4d4bc, hair: 0x2a2a3a, eye: 0x6a4a2a, top: 0x3a5a9a, topDark: 0x2a3e6e, bottom: 0x2e3a5a, boots: 0x2a2230, trim: 0xe8c86a, gear: 'book', hat: 'none', hairStyle: 'bob', face: 'calm', coat: 'coat', extras: ['glasses'] },
  knight: { skin: 0xf2caa8, hair: 0xc8a050, eye: 0x3a5ac8, top: 0xdce2ee, topDark: 0x9aa4bc, bottom: 0x3a4a8a, boots: 0x3a3a4a, trim: 0xe8c050, cape: 0x3a5ac8, gear: 'sword', hat: 'helm', helm: 'sallet', hairStyle: 'short', face: 'bright', coat: 'plate', capeKind: 'long' },
  nomad: { skin: 0xd8a47c, hair: 0x2a1e1a, eye: 0x2a2a2a, top: 0xc86a3a, topDark: 0x8a4228, bottom: 0x6a5a3a, boots: 0x4a3222, trim: 0x3aa8c8, cape: 0xe8c86a, gear: 'spear', hat: 'band', hairStyle: 'tied', face: 'cheer', coat: 'wrap', capeKind: 'shawl', extras: ['beads'] },
  shade: { skin: 0xe8d8e8, hair: 0x2a2238, eye: 0xc86aff, top: 0x2e2640, topDark: 0x1e182c, bottom: 0x262036, boots: 0x16121e, trim: 0x9a6aff, cape: 0x3a2e58, gear: 'lantern', hat: 'hood', hairStyle: 'bob', face: 'calm', coat: 'robe', capeKind: 'cloak' },
};

/**
 * The hero's (Pactbearer's) look. The save's path is a field left over from the old class choice, and new saves are always 'sword';
 * in the setting the Pactbearer is not a swordsman and the power comes from the pact mark on the back of the hand,
 * so neither carries a weapon and both wear a pouch holding pact stones instead.
 */
export function playerOutfit(path: 'sword' | 'magic'): Outfit {
  return path === 'magic'
    ? { skin: 0xffe0c8, hair: 0x4a3a6a, eye: 0x6a4ad8, top: 0x3e4a9a, topDark: 0x2a3272, bottom: 0x2e2a4a, boots: 0x5a3a2a, trim: 0xf2c65a, cape: 0x7a4ac8, gear: 'pact', hat: 'none', hairStyle: 'messy', face: 'bright', coat: 'tunic', capeKind: 'long', extras: ['strap'] }
    : { skin: 0xffe0c8, hair: 0x5a3a26, eye: 0x3a7ad8, top: 0xf2f0ea, topDark: 0xb8c0d8, bottom: 0x3a4a7a, boots: 0x6a4228, trim: 0xe8b84a, cape: 0xc8483a, gear: 'pact', hat: 'none', hairStyle: 'messy', face: 'bright', coat: 'tunic', capeKind: 'long', extras: ['strap'] };
}

export function npcOutfit(look: NpcLook): Outfit {
  return OUTFITS[look];
}

/** The three people of the prologue (used by sets.ts; the masked figure's scale is given separately there) */
export const PROLOGUE_LOOKS = {
  /** Elda: the first Pactbearer. Long dark hair, a gold circlet, white clothes, a deep blue cape, amber eyes */
  elda: { skin: 0xffe2cf, hair: 0x2e2446, eye: 0xe0a030, top: 0xf6f2ea, topDark: 0xcab27a, bottom: 0x3e3e76, boots: 0x5a4030, trim: 0xf0c860, cape: 0x2e4a9a, gear: 'none', hat: 'none', hairStyle: 'long', face: 'bright', coat: 'tunic', capeKind: 'long', extras: ['circlet'], brows: 'fine' },
  /** The child: orange hair, a red scarf */
  child: { skin: 0xffdcc4, hair: 0xe0903a, eye: 0x3a7ad8, top: 0x8ad0f0, topDark: 0x5aa0c8, bottom: 0xf2e2b0, boots: 0x7a4a2a, trim: 0xffffff, gear: 'none', hat: 'none', scale: 0.72, hairStyle: 'messy', face: 'cheer', coat: 'shirt', legwear: 'shorts', extras: ['scarf'], scarf: 0xe8483a },
  /** The masked figure: a hood, a floor-length robe, a pale expressionless mask */
  masked: { skin: 0xd8d0dc, hair: 0x14101c, eye: 0x000000, top: 0x1c1828, topDark: 0x100c18, bottom: 0x181422, boots: 0x0c0a12, trim: 0x8a5ad8, cape: 0x1e1830, gear: 'none', hat: 'hood', hairStyle: 'none', face: 'none', coat: 'gown', extras: ['mask'] },
} satisfies Record<string, Outfit>;

// ───────────────────────── Body size (an adult at scale 1) ─────────────────────────

/** Height of the pelvis (hips) above the ground */
const HIP = 0.44;
const LEG_X = 0.085;
const THIGH = 0.17;
const SHIN = 0.17;
const SH_X = 0.172;
const SH_Y = 0.395;
const UPPER = 0.15;
const FORE = 0.125;
const NECK_Y = 0.455;
/** The body's lathe profile [radius, y] (hips coordinates), with the cross-section flattened front to back to 0.78 */
const TORSO: [number, number][] = [[0.001, -0.095], [0.12, -0.09], [0.158, -0.045], [0.165, 0.04], [0.156, 0.13], [0.163, 0.22], [0.173, 0.31], [0.166, 0.365], [0.132, 0.415], [0.078, 0.452], [0.001, 0.466]];
const ZS = 0.78;
function torsoR(y: number): number {
  for (let i = 0; i < TORSO.length - 1; i++) {
    const [r0, y0] = TORSO[i];
    const [r1, y1] = TORSO[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return y < TORSO[0][1] ? TORSO[0][0] : 0;
}
/** Body surface (hips coordinates): θ around y, 0 faces front, lift goes outward horizontally */
function torsoAt(th: number, y: number, lift: number): THREE.Vector3 {
  const r = torsoR(y) + lift;
  return new THREE.Vector3(Math.sin(th) * r, y, Math.cos(th) * r * ZS);
}

/**
 * KayKit's heads (kaykitHeads.ts, CC0 original meshes): the face, nose, ears, eyes, brows and hair all use the originals
 * directly. Pick one by hairstyle:
 * the Knight has short side-parted hair, the Rogue has chin-length hair, the Mage has hair covering the forehead (with a
 * small bundle tied at the back, removed for those who do not tie it), the Barbarian is bald with a beard.
 * Those wearing helmets or hoods only use the bald head, and the hair under a hat is still our own close-fitting short hair,
 * so the original's hair does not poke out of the hat.
 * young: KayKit's face is an adult's, and the hero, Mila, Elda and the children should look young (narrower jaw,
 * shorter chin, slightly bigger eyes, thin high brows).
 */
interface KKSpec extends KKLook {
  hair: boolean;
  /** Whether to keep the Mage's bundle at the back of the head (and the hair tie) */
  tail: boolean;
}
function kaykitOf(o: Outfit, style: HairStyle): KKSpec {
  const kid = (o.scale ?? 1) < 0.9;
  if (o.hat === 'helm' || o.hat === 'hood') return { head: 'knight', hair: false, tail: false, young: 0 };
  if (o.hat === 'beard' || style === 'elder') return { head: 'barbarian', hair: false, tail: false, young: 0 };
  switch (style) {
    // Mila: the Rogue's hair plus twin tails; Elda: the Rogue's hair, with a piece of long hair below the shoulders attached behind it
    case 'twintails':
      return { head: 'rogue', hair: true, tail: false, young: 1 };
    case 'long':
      return { head: 'rogue', hair: true, tail: false, young: 0.8 };
    // Hero, children: the Mage's forehead-covering hair (back bundle removed) plus a tuft of sticking-up hair, a teenager's look
    case 'messy':
      return { head: 'mage', hair: true, tail: false, young: kid ? 1.4 : 1 };
    // Townsfolk: the Knight's short side-parted hair, adult
    case 'short':
      return { head: 'knight', hair: true, tail: false, young: 0 };
    case 'none':
      return { head: 'knight', hair: false, tail: false, young: 0 };
    // Scholars, herders: the Mage's hair, with a small bundle tied at the back of the head
    default:
      return { head: 'mage', hair: true, tail: true, young: 0 };
  }
}
let HEAD_KK: HeadShape | null = null;
/** The head shape of the KayKit head: just the original skull (no chin taper, no added relief, the nose is in the original mesh) */
function headShapeKK(): HeadShape {
  return (HEAD_KK ??= new HeadShape(0.31, 0.3, 0.3));
}

/**
 * Facial feature positions (normalized skull coordinates: half-width and half-height are both 1, +y faces up),
 * following KayKit's proportions: the eyes are very small dark upright ovals, about a ninth of the head height tall,
 * the eye line is just below the middle of the head height and the eyes are set well apart (centered at about one third and
 * two thirds of the face width); the brows are short and thick, above the eyes; the nose tip is below and between the eyes,
 * and the mouth is below the nose tip.
 * eyeRX, eyeRY, browL, browT are the sizes of the shapes on the face (radians of latitude and longitude).
 */
const FACE = { eyeX: 0.4, eyeY: -0.19, eyeRX: 0.056, eyeRY: 0.088, browX: 0.41, browDY: 0.215, browL: 0.15, browT: 0.098, mouthY: -0.62, foreheadY: 0.4 };
/** Facial feature positions of the KayKit head (the original's eye centers); glasses and face anchors are placed by this */
const FACE_KK = { ...FACE, eyeX: 0.449, eyeY: -0.19, browX: 0.44, mouthY: -0.64 };

/**
 * Expressions: eye width and height multipliers and vertical offset, brow height (browDY), outer end raised or lowered
 * (browTilt, positive means the outer end is higher), curvature, length and thickness multipliers, mouth width and upturn.
 * bright is lively, cheer is cheerful (high brows, open-mouth smile), kind is gentle (brow outer ends droop,
 * eyes slightly flat), stern is serious (low straight brows, flat mouth, not fierce), calm is quiet (flat brows, small mouth).
 */
const FACE_KIND: Record<Exclude<FaceKind, 'none'>, { eyeW: number; eyeH: number; eyeDY: number; browDY: number; browTilt: number; browArch: number; browL: number; browT: number; mouthW: number; mouthCurve: number }> = {
  bright: { eyeW: 1, eyeH: 1, eyeDY: 0, browDY: 0, browTilt: 0.02, browArch: 0.014, browL: 1, browT: 1, mouthW: 0.08, mouthCurve: 0.022 },
  cheer: { eyeW: 1.03, eyeH: 1.06, eyeDY: 0.005, browDY: 0.035, browTilt: 0.012, browArch: 0.026, browL: 0.96, browT: 0.95, mouthW: 0.075, mouthCurve: 0 },
  kind: { eyeW: 1.02, eyeH: 0.9, eyeDY: -0.005, browDY: 0.01, browTilt: -0.03, browArch: 0.018, browL: 0.96, browT: 0.9, mouthW: 0.078, mouthCurve: 0.024 },
  stern: { eyeW: 0.98, eyeH: 0.9, eyeDY: 0, browDY: -0.045, browTilt: 0.018, browArch: 0.004, browL: 1.08, browT: 1.12, mouthW: 0.07, mouthCurve: 0 },
  calm: { eyeW: 0.98, eyeH: 0.94, eyeDY: 0, browDY: 0.01, browTilt: 0, browArch: 0.01, browL: 0.94, browT: 0.85, mouthW: 0.058, mouthCurve: 0.012 },
};

/** The base color of the eyes: nearly black, mixed with a little of the character's eye color */
const EYE_DARK = 0x1a1420;
const MOUTH = 0x6a2e38;

/** Brows: the hair color darkened, so even light hair gets a deep enough brow */
function browColor(hair: number): number {
  return mix(shade(hair, 0.62), 0x2a1c16, 0.3);
}

function defaults(o: Outfit): Required<Pick<Outfit, 'hairStyle' | 'face' | 'coat' | 'legwear'>> {
  return {
    hairStyle: o.hairStyle ?? (o.hat === 'twintails' ? 'twintails' : o.hat === 'beard' ? 'elder' : 'short'),
    face: o.face ?? 'bright',
    coat: o.coat ?? 'tunic',
    legwear: o.legwear ?? 'pants',
  };
}

const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const mix = (a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, k: number) => col(a).lerp(col(b), k).getHex();
const shade = (a: THREE.ColorRepresentation, k: number) => col(a).multiplyScalar(k).getHex();

/** The body surface's normal (hips coordinates, θ around y, 0 faces front) */
const bodyN = (th: number) => new THREE.Vector3(Math.sin(th), 0, Math.cos(th) / ZS).normalize();

/** Button: a rim ring plus a slightly domed face in the middle, attached to p facing n */
function button(parent: THREE.Object3D, p: THREE.Vector3, n: THREE.Vector3, r: number, mat: THREE.Material): void {
  const g = group(parent, [p.x, p.y, p.z]);
  g.quaternion.setFromUnitVectors(v3(0, 0, 1), n);
  part(g, new THREE.TorusGeometry(r * 0.74, r * 0.28, 4, 10), mat, 'trim');
  part(g, new THREE.SphereGeometry(r * 0.72, 8, 3, 0, PI * 2, 0, PI / 2), mat, 'trim', [0, 0, 0], [PI / 2, 0, 0], [1, 0.5, 1]);
}

/** A square clasp (buckle, boot buckle): a four-sided frame facing n, r is the half side length */
function buckle(parent: THREE.Object3D, p: THREE.Vector3, n: THREE.Vector3, r: number, mat: THREE.Material, pin = true): void {
  const g = group(parent, [p.x, p.y, p.z]);
  g.quaternion.setFromUnitVectors(v3(0, 0, 1), n);
  part(g, new THREE.TorusGeometry(r * 1.2, r * 0.22, 6, 4), mat, 'trim', [0, 0, 0], [0, 0, PI / 4], [1, 0.82, 1]);
  if (pin) part(g, tube([v3(-r * 0.5, 0, r * 0.1), v3(r * 0.8, 0, r * 0.2)], () => [r * 0.14, r * 0.14], { segs: 2, radial: 6 }), mat, 'trim');
}

/** Creases in a sleeve or trouser leg: a diagonal ring of undulation around t0 (width w), for tube's ripple */
const folds = (t0: number, w: number, amp: number, n = 2, twist = 12, ph = 0) => (t: number, a: number) => amp * Math.exp(-(((t - t0) / w) ** 2)) * Math.sin(n * a + t * twist + ph);
const addF = (...fs: ((t: number, a: number) => number)[]) => (t: number, a: number) => fs.reduce((acc, f) => acc + f(t, a), 0);

// ───────────────────────── Character ─────────────────────────

/**
 * The character model. The origin is at the soles; speed (meters per second) sets the stride frequency and amplitude, and air means mid-jump.
 * It borrows Creature internally to manage material registration, the hit flash and fade-out; the blink hangs on Creature's
 * tickHooks, so the prologue blinks even though it only calls c.update.
 */
export class Avatar {
  c = new Creature();
  root: THREE.Group;
  // Limb nodes: normally driven by update(); the prologue animations do not call update() and pose them directly
  readonly hips = new THREE.Group();
  readonly torso = new THREE.Group();
  /** Thigh (pivot at the hip joint) */
  readonly legs: THREE.Group[] = [];
  /** Shin (pivot at the knee) */
  readonly shins: THREE.Group[] = [];
  /** Upper arm (pivot at the shoulder, hanging down toward -y); arms[0] is the right arm (the -x side) */
  readonly arms: THREE.Group[] = [];
  /** Forearm (pivot at the elbow) */
  readonly fores: THREE.Group[] = [];
  /** Center of the palm */
  readonly hands: THREE.Group[] = [];
  readonly cape: THREE.Group | null = null;
  readonly tails: THREE.Group[] = [];
  /** Standing height of the pelvis */
  readonly hipY = HIP;
  /** Center of the forehead (head coordinates), used for the prologue's forehead touch */
  readonly foreheadLocal = new THREE.Vector3();
  /** Empty nodes at the center of the face, the two eyes and the mouth (in head coordinates), used by the lab bench and camera framing */
  faceAnchors!: { face: THREE.Object3D; eyes: THREE.Object3D[]; mouth: THREE.Object3D };
  /** This person's head shape (nose size depends on the character) */
  private hs!: HeadShape;
  /** Which KayKit head is used (the original's face, features, hair) */
  private kk!: KKSpec;
  /** Facial feature positions: for a KayKit head, the original eyes' positions */
  private fc = FACE;
  private armBase: THREE.Euler[] = [];
  private foreBase: number[] = [];
  /** The hand holding something, with a small swing when walking */
  private holding = [false, false];
  private phase = 0;
  private sway = 0;
  private t = Math.random() * 10;
  private look = 0;
  private lookGoal = 0;
  private lookIn = 1 + Math.random() * 3;
  private extraMats: THREE.Material[] = [];
  speed = 0;
  air = false;
  /** 0-1: waving (an NPC being talked to, the hero interacting) */
  wave = 0;
  height: number;

  /**
   * opt.merge: when false, vertex colors are not baked and only parts with the same material are merged (the lab bench's
   * &hide hides parts by outline group, and &nomerge is for comparison)
   */
  constructor(o: Outfit, opt: { merge?: boolean } = {}) {
    const c = this.c;
    const M = new Mats(c);
    const d = defaults(o);
    this.root = c.root;
    // For debugging and performance checks: all characters can be found in the scene
    this.root.name = 'avatar';
    const s = o.scale ?? 1;
    c.scaler.scale.setScalar(s);
    c.body.add(this.hips);
    this.hips.position.y = HIP;
    this.hips.add(this.torso);
    // Children's heads are relatively large, a tall masked figure's head relatively small
    const headK = 1 + (1 - s) * 0.55;

    const skin = M.toon(o.skin, { skin: true });
    const robeLong = d.coat === 'robe' || d.coat === 'gown';

    this.buildLegs(o, d.legwear, robeLong, M, skin);
    this.buildTorso(o, d.coat, d.legwear, M);
    this.buildArms(o, d.coat, M, skin);
    const head = this.buildHead(o, d.hairStyle, d.face, headK, M, skin);
    if (o.capeKind && o.cape !== undefined) this.buildCape(o, o.capeKind, M);
    this.buildGear(o, M);
    this.buildExtras(o, head, M);

    // Standing pose, then merge the parts and mark outlines. Nodes that move or toggle each get their own vertex-color mesh;
    // &nomerge (lab bench) only merges parts with the same material
    this.restPose();
    const open = head.getObjectByName('eyesOpen');
    const shut = head.getObjectByName('eyesShut');
    if (opt.merge ?? true) {
      const owners: THREE.Object3D[] = [this.hips, this.torso, ...this.legs, ...this.shins, ...this.arms, ...this.fores, head, ...this.tails];
      if (this.cape) owners.push(this.cape);
      for (const g of [open, shut]) if (g) owners.push(g);
      const fa = this.faceAnchors;
      mergePerson(this.root, M, owners, [...this.hands, fa.face, fa.mouth, ...fa.eyes]);
    } else mergeStatic(this.root);
    this.root.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = false;
    });
    inkPerson(this.root);

    // Blink: switch between the open-eye and closed-eye shape sets
    if (open && shut) {
      let next = 1 + Math.random() * 3;
      let tShut = 0;
      let again = false;
      c.tickHooks.push((dt) => {
        next -= dt;
        if (next <= 0) {
          tShut = 0.12;
          again = Math.random() < 0.18;
          next = again ? 0.22 : 2.2 + Math.random() * 3.5;
        }
        if (tShut > 0) tShut -= dt;
        open.visible = tShut <= 0;
        shut.visible = tShut > 0;
      });
    }

    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root);
    this.height = box.max.y;
    c.height = this.height / s;
    c.worldHeight = this.height;
    c.width = 0.6 * s;
  }

  // ───────────── Legs ─────────────

  private buildLegs(o: Outfit, legwear: Legwear, robe: boolean, M: Mats, skin: SpiritMaterial): void {
    const pants = M.toon(o.bottom);
    const boot = M.toon(o.boots);
    const sole = M.toon(shade(o.boots, 0.55));
    const bootFold = M.toon(mix(o.boots, 0xffffff, 0.12));
    const sock = M.toon(o.trim);
    const strapM = M.toon(shade(o.boots, 0.72));
    const buckleM = M.toon(mix(o.trim, 0x9a9aa8, 0.5), { surface: 'metal' });
    const bare = legwear === 'shorts' || legwear === 'skirt';
    for (const sx of [-1, 1]) {
      const leg = group(this.hips, [sx * LEG_X, 0, 0]);
      if (!robe) {
        if (legwear === 'shorts') {
          // Short trouser legs: a ring thicker than the thigh, with a turned-up lower edge
          part(leg, revShell([[0.082, 0.02], [0.088, -0.06], [0.09, -0.085]], 0.02, { seg: 20 }), pants, 'bottom');
          part(leg, tube([v3(0, 0.02, 0), v3(0, -THIGH * 0.5, 0.004), v3(0, -THIGH - 0.02, 0)], roundEnds(0.062, 0.054, 0.15), { segs: 12 }), skin, 'skin');
        } else if (legwear === 'skirt') {
          part(leg, tube([v3(0, 0.0, 0), v3(0, -THIGH * 0.5, 0.004), v3(0, -THIGH - 0.02, 0)], roundEnds(0.062, 0.054, 0.15), { segs: 12 }), skin, 'skin');
        } else {
          // Long trousers: a few diagonal creases above the knee
          part(leg, tube([v3(0, 0.04, 0), v3(0, -THIGH * 0.5, 0.006), v3(0, -THIGH - 0.02, 0)], roundEnds(0.078, 0.064, 0.14), { segs: 16, radial: 14, ripple: folds(0.8, 0.12, 0.055, 2, 10, sx) }), pants, 'bottom');
        }
      }
      const shin = group(leg, [0, -THIGH, 0]);
      // The trouser legs bunch into a few folds above the boot opening
      if (!robe) part(shin, tube([v3(0, 0.03, 0), v3(0, -SHIN * 0.5, -0.004), v3(0, -SHIN + 0.01, 0)], roundEnds(bare ? 0.055 : 0.064, bare ? 0.048 : 0.056, 0.15), { segs: bare ? 12 : 16, radial: bare ? 12 : 14, ripple: bare ? undefined : addF(folds(0.12, 0.1, 0.04, 2, 8, 1 + sx), folds(0.42, 0.12, 0.06, 3, 16, sx)) }), bare ? skin : pants, bare ? 'skin' : 'bottom');
      // Boot shaft (a thick shell) + turned-down cuff; children in shorts get an extra length of sock
      const ankle = -SHIN;
      const shaftTop = robe ? ankle + 0.07 : legwear === 'skirt' ? -0.02 : ankle + 0.1;
      part(shin, revSolid([[0.001, ankle - 0.01], [0.058, ankle - 0.005], [0.064, ankle + 0.03], [0.066, shaftTop - 0.02], [0.062, shaftTop], [0.001, shaftTop]], { seg: 20, zs: 0.95 }), boot, 'boots');
      part(shin, revShell([[0.074, shaftTop + 0.012], [0.078, shaftTop - 0.025]], 0.014, { seg: 20, zs: 0.95 }), bootFold, 'boots');
      if (legwear === 'shorts') part(shin, revShell([[0.06, shaftTop + 0.05], [0.062, shaftTop + 0.005]], 0.012, { seg: 18 }), sock, 'trim');
      // Foot: a round-toed shoe facing forward, the sole a separate dark beveled plate
      const foot = group(shin, [0, ankle, 0], [0, sx * 0.1, 0]);
      const floor = -(HIP - THIGH - SHIN);
      part(foot, tube([v3(0, floor + 0.045, -0.045), v3(0, floor + 0.05, 0.02), v3(0, floor + 0.04, 0.085), v3(0, floor + 0.034, 0.118)], (t) => {
        const e = Math.sqrt(Math.max(0, Math.min(1, Math.sin(Math.min(1, t / 0.22) * PI * 0.5), Math.sin(Math.min(1, (1 - t) / 0.3) * PI * 0.5))));
        return [0.056 * e * (0.9 + 0.1 * t), 0.045 * e * (1 - 0.3 * t)];
      }, { segs: 16, radial: 16, side: new THREE.Vector3(1, 0, 0) }), boot, 'boots');
      part(foot, rbox(0.108, 0.022, 0.19, 0.01), sole, 'sole', [0, floor + 0.011, 0.036]);
      // Heel: a raised block at the back
      part(foot, rbox(0.094, 0.032, 0.06, 0.01, 1), sole, 'sole', [0, floor + 0.016, -0.03]);
      // Straps on the boot shaft and a square buckle on the outer side
      const strapY = ankle + (robe ? 0.035 : 0.045);
      part(shin, revShell([[0.07, strapY + 0.011], [0.071, strapY - 0.011]], 0.01, { seg: 22, zs: 0.95 }), strapM, 'boots');
      buckle(shin, v3(sx * 0.071, strapY, 0.012), v3(sx, 0, 0.25).normalize(), 0.012, buckleM);
      this.legs.push(leg);
      this.shins.push(shin);
    }
  }

  // ───────────── Body and clothes ─────────────

  private buildTorso(o: Outfit, coat: Coat, legwear: Legwear, M: Mats): void {
    const T = this.torso;
    const top = M.toon(o.top, { surface: coat === 'armor' || coat === 'plate' ? 'metal' : 'matte', spec: coat === 'armor' || coat === 'plate' ? 0.25 : undefined });
    const cloth = M.toon(o.top);
    const dark = M.toon(o.topDark, { surface: coat === 'plate' ? 'metal' : 'matte' });
    const darkCloth = M.toon(o.topDark);
    const pants = M.toon(o.bottom);
    const trim = M.toon(o.trim, { surface: 'metal' });
    const leather = M.toon(mix(o.boots, 0x000000, 0.1));
    const upper = (prof: [number, number][]) => revSolid(prof, { seg: 36, zs: ZS });
    // The top is cinched by the belt: a ring of straight gathers above the belt, gradually flattening out upward (y0 is the belt's height)
    const gathered = (prof: [number, number][], y0: number) => revSolid(prof, { seg: 44, zs: ZS, sub: 2, wave: (th, y) => 0.03 * Math.sin(th * 11 + 0.4 * Math.sin(th * 3)) * Math.exp(-(((y - y0) / 0.07) ** 2)) * smoothstep(y, y0 - 0.04, y0 - 0.02) });
    // Pelvis: the trousers' color, with the upper edge hidden inside the top
    const pelvis: [number, number][] = [[0.001, -0.1], [0.124, -0.094], [0.162, -0.048], [0.169, 0.03], [0.166, 0.09], [0.001, 0.09]];
    const chest = TORSO.filter(([, y]) => y >= 0.03);
    chest.unshift([0.001, 0.03], [0.166, 0.03]);
    // Belt: a leather belt and a few belt loops; with a buckle it is a square-frame buckle plus a prong,
    // the belt's tail passes through the buckle and lies on the right, held by a leather loop
    const belt = (y: number, color: THREE.Material, withBuckle = true, loops = true) => {
      part(T, revShell([[torsoR(y) + 0.012, y + 0.028], [torsoR(y) + 0.013, y - 0.028]], 0.022, { seg: 36, zs: ZS }), color, 'cloth');
      if (loops)
        for (const th of [0.8, -0.8, 1.9, -1.9, PI]) {
          const p = torsoAt(th, y, 0.016);
          part(T, rbox(0.014, 0.066, 0.008, 0.003, 1), color, 'cloth', [p.x, p.y, p.z], [0, th, 0]);
        }
      if (withBuckle) {
        buckle(T, torsoAt(0, y, 0.019), bodyN(0), 0.022, trim);
        const t0 = torsoAt(-0.1, y, 0.017);
        const t1 = torsoAt(-0.46, y - 0.004, 0.017);
        part(T, tube([t0, t0.clone().lerp(t1, 0.5), t1], (t) => [0.017 * (1 - 0.35 * smoothstep(t, 0.8, 1)), 0.0045], { segs: 6, radial: 8, side: v3(0, 1, 0) }), color, 'cloth');
        const kp = torsoAt(-0.3, y, 0.02);
        part(T, rbox(0.012, 0.06, 0.012, 0.003, 1), color, 'cloth', [kp.x, kp.y, kp.z], [0, -0.3, 0]);
      }
    };
    const buttons = (ys: number[], mat: THREE.Material, lift = 0.006, r = 0.011, th = 0) => {
      for (const y of ys) button(T, torsoAt(th, y, lift), bodyN(th), r, mat);
    };
    // Seam: a thin ridge (same fabric) hugging the body, from y0 to y1
    const seam = (th: number, y0: number, y1: number, mat: THREE.Material, role: Role, lift = 0.002) =>
      part(T, tube([torsoAt(th, y0, lift), torsoAt(th, (y0 + y1) / 2, lift), torsoAt(th, y1, lift)], () => [0.0035, 0.0035], { segs: 8, radial: 6 }), mat, role);
    // Pocket: a flap (a beveled plate) plus one button
    const pocket = (th: number, y: number, lift: number, w: number, mat: THREE.Material, btn: THREE.Material | null, tilt = 0) => {
      const p = torsoAt(th, y, lift);
      part(T, slab(outline([[-w / 2, 0.012], [w / 2, 0.012], [w / 2 - 0.006, -0.018], [0, -0.024], [-w / 2 + 0.006, -0.018]]), 0.006, 0.003, 3), mat, 'topDark', [p.x, p.y, p.z], [tilt, th, 0]);
      if (btn) button(T, torsoAt(th, y - 0.01, lift + 0.007), bodyN(th), 0.008, btn);
    };
    // Neckline: a stand-up collar shell with a gap at the front
    const collar = (mat: THREE.Material, h = 0.05, open = 0.26) => part(T, revShell([[0.086, NECK_Y + 0.035], [0.098, NECK_Y + 0.0], [0.112, NECK_Y - h + 0.03]], 0.012, { a0: open, a1: 2 * PI - open, seg: 30, zs: 0.92 }), mat, 'topDark');
    // Hem: a shell flaring out from the waist
    const hem = (mat: THREE.Material, y0: number, y1: number, r0: number, r1: number, role: Role, o2: { a0?: number; a1?: number; wave?: (th: number, v: number) => number } = {}) =>
      part(T, revShell([[r0, y0], [lerp(r0, r1, 0.45), lerp(y0, y1, 0.5)], [r1, y1]], 0.013, { seg: 36, zs: 0.84, ...o2 }), mat, role);

    if (coat !== 'gown') part(T, upper(pelvis), pants, 'bottom');

    switch (coat) {
      case 'tunic': {
        part(T, gathered(chest, 0.075), cloth, 'top');
        hem(cloth, 0.07, -0.15, 0.17, 0.22, 'top', { wave: (th, v) => 0.025 * Math.sin(th * 6) * v * v });
        // Piping on the lower hem
        part(T, revShell([[0.22, -0.118], [0.228, -0.158]], 0.018, { seg: 36, zs: 0.84, wave: (th) => 0.025 * Math.sin(th * 6) }), darkCloth, 'topDark');
        collar(darkCloth, 0.05, 0.3);
        // Front placket: a dark placket from the collar to the belt
        part(T, tube([torsoAt(0, NECK_Y - 0.01, 0.004), torsoAt(0, 0.3, 0.006), torsoAt(0, 0.12, 0.004)], () => [0.018, 0.006], { segs: 10, radial: 10, side: new THREE.Vector3(1, 0, 0) }), darkCloth, 'topDark');
        buttons([0.4, 0.33, 0.26, 0.19], trim, 0.013, 0.0105);
        // Two seams on the front panel: from the shoulder to the waist, so the garment looks tailored
        for (const sx of [-1, 1]) seam(sx * 0.62, 0.41, 0.1, cloth, 'top');
        belt(0.075, leather);
        break;
      }
      case 'blouse': {
        part(T, upper(chest), cloth, 'top');
        // Sailor collar: a wide collar covering the shoulders, V-shaped at the front
        part(T, revShell([[0.09, NECK_Y + 0.02], [0.17, NECK_Y - 0.035], [0.205, NECK_Y - 0.1], [0.21, NECK_Y - 0.125]], 0.014, { a0: 0.42, a1: 2 * PI - 0.42, seg: 40, zs: 0.86 }), darkCloth, 'topDark');
        // A white line on the collar edge
        part(T, revShell([[0.2085, NECK_Y - 0.098], [0.2125, NECK_Y - 0.112]], 0.006, { a0: 0.44, a1: 2 * PI - 0.44, seg: 40, zs: 0.86, sub: 1 }), cloth, 'top');
        // Pleated skirt, with a white line on the lower edge
        const pleat = (th: number, v: number) => 0.06 * (Math.abs(((th * 16) / (2 * PI)) % 1 - 0.5) - 0.25) * (0.3 + v);
        hem(pants, 0.09, -0.19, 0.17, 0.27, 'bottom', { wave: pleat });
        part(T, revShell([[0.2655, -0.156], [0.2715, -0.172]], 0.008, { seg: 64, zs: 0.84, sub: 1, wave: (th) => pleat(th, 0.93) }), cloth, 'top');
        belt(0.085, darkCloth, false);
        break;
      }
      case 'vest': {
        part(T, upper(chest), cloth, 'top');
        // Vest: open at the front, the lower edge reaching below the waist
        part(T, revShell([[0.1, NECK_Y - 0.005], [0.168, 0.4], [0.183, 0.31], [0.175, 0.2], [0.178, 0.08], [0.188, -0.02]], 0.013, { a0: 0.34, a1: 2 * PI - 0.34, seg: 40, zs: 0.82 }), darkCloth, 'topDark');
        // Buttons on the vest placket (both sides)
        for (const sx of [-1, 1]) buttons([0.3, 0.2, 0.1], trim, 0.022, 0.01, sx * 0.42);
        // Vest piping: both sides of the front and the lower edge
        const vp: [number, number][] = [[0.1, NECK_Y - 0.005], [0.168, 0.4], [0.183, 0.31], [0.175, 0.2], [0.178, 0.08], [0.188, -0.02]];
        const pipe = M.toon(mix(o.topDark, 0x000000, 0.25));
        for (const sx of [-1, 1]) part(T, tube(vp.map(([r, y]) => v3(Math.sin(sx * 0.34) * (r + 0.001), y, Math.cos(0.34) * (r + 0.001) * 0.82)), () => [0.0065, 0.0065], { segs: 18, radial: 8 }), pipe, 'topDark');
        part(T, revShell([[0.1895, -0.004], [0.1905, -0.024]], 0.016, { a0: 0.34, a1: 2 * PI - 0.34, seg: 40, zs: 0.82, sub: 1 }), pipe, 'topDark');
        // Two pocket flaps
        for (const sx of [-1, 1]) pocket(sx * 0.78, 0.12, 0.028, 0.07, darkCloth, null, -0.05);
        belt(0.05, leather);
        break;
      }
      case 'robe': {
        part(T, upper(chest), cloth, 'top');
        // Ankle-length robe: dark front panel, gold edging on the lower hem
        hem(cloth, 0.09, -0.43, 0.168, 0.28, 'top');
        part(T, revShell([[0.176, 0.09], [0.215, -0.17], [0.288, -0.43]], 0.012, { a0: -0.26, a1: 0.26, seg: 10, zs: 0.85 }), darkCloth, 'topDark');
        part(T, revShell([[0.281, -0.385], [0.29, -0.43]], 0.02, { seg: 36, zs: 0.84 }), M.toon(o.trim), 'trim');
        // Long sashes draped over the chest (two)
        for (const sx of [-1, 1]) part(T, tube([torsoAt(sx * 0.62, NECK_Y - 0.01, 0.01), torsoAt(sx * 0.36, 0.3, 0.012), torsoAt(sx * 0.3, 0.12, 0.01)], () => [0.024, 0.007], { segs: 10, radial: 10 }), darkCloth, 'topDark');
        // Gold edging on both sides of the front panel
        const gold = M.toon(o.trim);
        for (const sx of [-1, 1]) part(T, tube([[0.18, 0.09], [0.216, -0.17], [0.29, -0.4]].map(([r, y]) => v3(Math.sin(sx * 0.26) * r, y, Math.cos(0.26) * r * 0.85)), () => [0.007, 0.007], { segs: 14, radial: 8 }), gold, 'trim');
        belt(0.1, darkCloth, false, false);
        // The belt is knotted at the front left, with two tails hanging down
        const kn = torsoAt(0.7, 0.1, 0.03);
        part(T, new THREE.SphereGeometry(0.026, 12, 10), darkCloth, 'topDark', [kn.x, kn.y, kn.z], [0, 0, 0], [1.1, 0.85, 0.8]);
        for (const [dx, len] of [[0.01, 0.2], [0.035, 0.15]]) part(T, tube([kn.clone(), kn.clone().add(v3(dx, -len * 0.5, 0.012)), kn.clone().add(v3(dx * 1.6, -len, 0.02))], (t) => [0.017 * (1 + 0.3 * t), 0.005], { segs: 10, radial: 8, side: v3(1, 0, -0.5) }), darkCloth, 'topDark');
        collar(darkCloth, 0.045, 0.4);
        break;
      }
      case 'armor':
      case 'plate': {
        // Cloth undershirt + hem, with a beveled breastplate over it (front and back as one piece),
        // ridges on the breastplate's upper edge and midline, and a ring of rivets around the edge
        part(T, upper(chest), darkCloth, 'cloth');
        hem(coat === 'plate' ? pants : darkCloth, 0.07, -0.16, 0.17, 0.225, 'cloth', { wave: (th, v) => 0.018 * Math.sin(th * 10) * v });
        const plate = revShell([[0.145, 0.41], [0.182, 0.355], [0.19, 0.25], [0.184, 0.15], [0.178, 0.08]], 0.02, { seg: 40, zs: 0.82 });
        part(T, plate, top, 'metal');
        part(T, tube([torsoAt(0, 0.38, 0.02), torsoAt(0, 0.25, 0.028), torsoAt(0, 0.1, 0.02)], roundEnds(0.009, 0.009, 0.2), { segs: 10, radial: 10 }), top, 'metal');
        // Binding on the upper edge
        part(T, revShell([[0.15, 0.418], [0.158, 0.395]], 0.018, { seg: 40, zs: 0.82 }), coat === 'plate' ? trim : dark, coat === 'plate' ? 'trim' : 'topDark');
        const rg = new THREE.SphereGeometry(1, 10, 8, 0, PI * 2, 0, PI / 2);
        for (let k = 0; k < 10; k++) {
          const th = -PI + ((k + 0.5) / 10) * 2 * PI;
          const p = torsoAt(th, 0.1, 0.03);
          const n = new THREE.Vector3(Math.sin(th), 0, Math.cos(th) / ZS).normalize();
          const m = part(T, rg.clone(), trim, 'trim', [p.x, p.y, p.z], [0, 0, 0], [0.009, 0.006, 0.009]);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        }
        // Binding on the breastplate's lower edge, and two rivets each on the upper edge of the two tassets (at both sides of the front waist)
        part(T, revShell([[0.1815, 0.092], [0.1805, 0.072]], 0.02, { seg: 40, zs: 0.82, sub: 1 }), coat === 'plate' ? trim : dark, coat === 'plate' ? 'trim' : 'topDark');
        for (const sx of [-1, 1]) {
          part(T, revShell([[0.19, 0.045], [0.205, -0.03], [0.214, -0.085]], 0.012, { a0: sx > 0 ? 0.12 : -0.92, a1: sx > 0 ? 0.92 : -0.12, seg: 12, zs: 0.84 }), top, 'metal');
          for (const a of [0.3, 0.74]) {
            const th = sx * a;
            const p = v3(Math.sin(th) * 0.197, 0.03, Math.cos(th) * 0.197 * 0.84);
            const m = part(T, rg.clone(), trim, 'trim', [p.x, p.y, p.z], [0, 0, 0], [0.008, 0.005, 0.008]);
            m.quaternion.setFromUnitVectors(v3(0, 1, 0), bodyN(th));
          }
        }
        belt(0.06, leather);
        if (coat === 'plate') {
          // A gold diamond emblem on the chest (small, so it does not compete with the face)
          const e = torsoAt(0, 0.29, 0.034);
          part(T, slab(outline([[0, 0.034], [0.024, 0], [0, -0.034], [-0.024, 0]]), 0.006, 0.003, 4), trim, 'trim', [e.x, e.y, e.z], [-0.12, 0, 0]);
        }
        break;
      }
      case 'shirt': {
        part(T, legwear === 'shorts' ? gathered(chest, 0.06) : upper(chest), cloth, 'top');
        hem(cloth, 0.07, -0.08, 0.168, 0.19, 'top');
        // Piping on the round neckline
        part(T, revShell([[0.092, NECK_Y + 0.012], [0.1, NECK_Y - 0.018]], 0.016, { seg: 30, zs: 0.9 }), darkCloth, 'topDark');
        // A horizontal stripe across the chest
        part(T, revShell([[torsoR(0.25) + 0.006, 0.27], [torsoR(0.23) + 0.006, 0.23]], 0.01, { seg: 36, zs: ZS }), M.toon(o.trim), 'trim');
        // A short length of placket below the neckline, with two buttons
        part(T, tube([torsoAt(0, NECK_Y - 0.012, 0.003), torsoAt(0, 0.36, 0.004)], () => [0.015, 0.004], { segs: 4, radial: 8, side: v3(1, 0, 0) }), darkCloth, 'topDark');
        buttons([0.415, 0.38], M.toon(o.trim), 0.009, 0.0085);
        if (legwear === 'shorts') belt(0.06, darkCloth, false, false);
        break;
      }
      case 'coat': {
        part(T, upper(chest), cloth, 'top');
        // Long coat: slit open at the front to the knee, with lapels and gold buttons
        hem(cloth, 0.09, -0.27, 0.172, 0.25, 'top', { a0: 0.3, a1: 2 * PI - 0.3 });
        for (const sx of [-1, 1]) part(T, tube([torsoAt(sx * 0.2, NECK_Y + 0.0, 0.012), torsoAt(sx * 0.42, 0.36, 0.016), torsoAt(sx * 0.3, 0.24, 0.014), torsoAt(sx * 0.12, 0.15, 0.008)], (t) => [0.03 * (1 - t * 0.6), 0.008], { segs: 14, radial: 10 }), darkCloth, 'topDark');
        collar(darkCloth, 0.055, 0.34);
        buttons([0.28, 0.2, 0.12], trim, 0.008, 0.012);
        // Pocket flaps at the sides of the waist, a half belt at the back (two buttons)
        for (const sx of [-1, 1]) {
          const th = sx * 0.95;
          const r = 0.196 + 0.006;
          const p = v3(Math.sin(th) * r, -0.035, Math.cos(th) * r * 0.84);
          part(T, slab(outline([[-0.04, 0.012], [0.04, 0.012], [0.036, -0.02], [-0.036, -0.02]]), 0.006, 0.003, 3), darkCloth, 'topDark', [p.x, p.y, p.z], [-0.2, th, 0]);
        }
        part(T, revShell([[torsoR(0.13) + 0.012, 0.15], [torsoR(0.11) + 0.013, 0.11]], 0.01, { a0: PI - 0.55, a1: PI + 0.55, seg: 12, zs: ZS, sub: 1 }), cloth, 'top');
        for (const sx of [-1, 1]) button(T, torsoAt(PI - sx * 0.45, 0.13, 0.024), bodyN(PI - sx * 0.45), 0.01, trim);
        break;
      }
      case 'wrap': {
        part(T, gathered(chest, 0.16), cloth, 'top');
        const wv = (th: number, v: number) => 0.02 * Math.sin(th * 5 + 1) * v;
        hem(cloth, 0.07, -0.13, 0.17, 0.215, 'top', { wave: wv });
        // Embroidered band on the hem: a ring of dark ribbon with a row of diamond embroidery on it
        part(T, revShell([[0.2105, -0.092], [0.2165, -0.124]], 0.008, { seg: 60, zs: 0.84, sub: 1, wave: (th) => wv(th, 0.92) }), darkCloth, 'topDark');
        // Diamond: short posts on four sides, the axis pointing outward, stretched up and down
        const dia = new THREE.CylinderGeometry(0.0085, 0.0085, 0.004, 4).rotateX(PI / 2).scale(1, 1.3, 1);
        const embM = M.toon(o.trim);
        for (let k = 0; k < 22; k++) {
          const th = -PI + ((k + 0.5) / 22) * 2 * PI;
          const r = 0.2135 * (1 + wv(th, 0.92)) + 0.002;
          part(T, dia.clone(), embM, 'trim', [Math.sin(th) * r, -0.108, Math.cos(th) * r * 0.84], [-0.2, th, 0]);
        }
        // Wide sash wrapped twice, knotted at the side and hanging down
        part(T, revShell([[torsoR(0.12) + 0.016, 0.16], [torsoR(0.08) + 0.018, 0.1], [torsoR(0.04) + 0.018, 0.03]], 0.026, { seg: 36, zs: ZS, wave: (th) => 0.03 * Math.sin(th * 3) }), darkCloth, 'topDark');
        const k = torsoAt(-1.1, 0.1, 0.03);
        part(T, new THREE.SphereGeometry(0.03, 12, 10), darkCloth, 'topDark', [k.x, k.y, k.z], [0, 0, 0], [1, 0.8, 0.8]);
        part(T, tube([v3(k.x, k.y, k.z), v3(k.x - 0.03, k.y - 0.08, k.z + 0.01), v3(k.x - 0.035, k.y - 0.17, k.z)], (t) => [0.024 * (1 - t * 0.3), 0.006], { segs: 10, radial: 10, side: new THREE.Vector3(0, 0, 1) }), darkCloth, 'topDark');
        collar(darkCloth, 0.04, 0.5);
        break;
      }
      case 'gown': {
        // A long robe hanging from the shoulders to the ground, with no waist
        part(T, revShell([[0.085, NECK_Y + 0.02], [0.17, NECK_Y - 0.05], [0.2, 0.3], [0.215, 0.05], [0.25, -0.2], [0.32, -0.44]], 0.02, { seg: 36, zs: 0.86, wave: (th, v) => 0.03 * Math.sin(th * 7) * v * v }), M.toon(o.cape ?? o.top), 'cape');
        part(T, upper(chest), darkCloth, 'cloth');
        // A thin cord at the waist, knotted at the front right, with two cord tails hanging down
        const cord = M.toon(mix(o.trim, o.cape ?? o.top, 0.55));
        part(T, revShell([[0.222, 0.075], [0.224, 0.055]], 0.012, { seg: 40, zs: 0.86, sub: 1 }), cord, 'trim');
        const kn = v3(Math.sin(-0.5) * 0.23, 0.065, Math.cos(-0.5) * 0.23 * 0.86);
        part(T, new THREE.SphereGeometry(0.016, 10, 8), cord, 'trim', [kn.x, kn.y, kn.z]);
        for (const dx of [-0.012, 0.01]) part(T, tube([kn.clone(), kn.clone().add(v3(dx, -0.1, 0.02)), kn.clone().add(v3(dx * 1.5, -0.2, 0.03))], (t) => [0.006 * (1 - t * 0.3), 0.006 * (1 - t * 0.3)], { segs: 8, radial: 6 }), cord, 'trim');
        break;
      }
    }
    // Neck
    part(T, tube([v3(0, NECK_Y - 0.04, 0.004), v3(0, NECK_Y + 0.1, 0.012)], () => [0.052, 0.05], { segs: 4, radial: 16 }), M.toon(o.skin, { skin: true }), 'skin');
  }

  // ───────────── Arms and hands ─────────────

  private buildArms(o: Outfit, coat: Coat, M: Mats, skin: SpiritMaterial): void {
    const sleeve = M.toon(coat === 'plate' || coat === 'armor' ? o.topDark : coat === 'gown' ? (o.cape ?? o.top) : o.top);
    const cuffM = M.toon(coat === 'gown' ? o.topDark : o.topDark);
    const trimM = M.toon(o.trim);
    const metal = M.toon(o.top, { surface: 'metal', spec: 0.25 });
    const short = coat === 'shirt';
    const rolled = coat === 'vest';
    const wide = coat === 'robe' || coat === 'gown';
    const puff = coat === 'blouse';
    for (const sx of [-1, 1]) {
      const arm = group(this.torso, [sx * SH_X, SH_Y, 0]);
      // Upper arm: the shoulder is a lofted round head, hidden inside the body
      // Cloth sleeves have a few diagonal creases at the inside of the elbow (puff sleeves do not)
      const clothSleeve = !(coat === 'plate' || coat === 'armor');
      part(arm, tube([v3(0, 0.04, 0), v3(sx * 0.004, -UPPER * 0.5, 0), v3(0, -UPPER - 0.01, 0)], (t) => {
        const r = roundEnds(puff ? 0.07 : 0.058, 0.05, 0.16)(t);
        const p = puff ? 1 + 0.18 * Math.sin(Math.min(1, t * 1.6) * PI) : 1;
        return [r[0] * p, r[1] * p];
      }, { segs: 16, radial: 14, ripple: clothSleeve && !puff ? folds(0.78, 0.12, 0.05, 2, 10, sx) : undefined }), sleeve, coat === 'plate' || coat === 'armor' ? 'topDark' : coat === 'gown' ? 'cape' : 'top');
      if (short) part(arm, revShell([[0.062, -0.07], [0.064, -0.1]], 0.014, { seg: 18 }), cuffM, 'topDark');
      if (coat === 'armor' || coat === 'plate') {
        // Pauldron: two beveled shells
        part(arm, revShell([[0.02, 0.085], [0.07, 0.07], [0.092, 0.03], [0.095, -0.02]], 0.014, { seg: 24 }), metal, 'metal', [sx * 0.008, 0, 0], [0, 0, sx * 0.25]);
        part(arm, revShell([[0.09, -0.005], [0.098, -0.04], [0.1, -0.06]], 0.014, { seg: 24 }), metal, 'metal', [sx * 0.012, 0, 0], [0, 0, sx * 0.25]);
      }
      const fore = group(arm, [0, -UPPER, 0]);
      const bareFore = short || rolled;
      part(fore, tube([v3(0, 0.03, 0), v3(0, -FORE * 0.5, 0.004), v3(0, -FORE + 0.005, 0)], roundEnds(bareFore ? 0.042 : 0.05, bareFore ? 0.036 : 0.043, 0.18), { segs: bareFore ? 12 : 16, radial: bareFore ? 12 : 14, ripple: bareFore ? undefined : addF(folds(0.14, 0.1, 0.045, 2, 9, 2 * sx), folds(0.7, 0.1, 0.035, 3, 14, sx)) }), bareFore ? skin : sleeve, bareFore ? 'skin' : coat === 'plate' || coat === 'armor' ? 'topDark' : coat === 'gown' ? 'cape' : 'top');
      if (rolled) part(fore, revShell([[0.056, 0.03], [0.06, 0.005], [0.056, -0.018]], 0.018, { seg: 18 }), sleeve, 'top');
      if (wide) {
        // Bell sleeve
        part(fore, revShell([[0.052, -0.02], [0.07, -0.08], [0.088, -FORE - 0.01]], 0.012, { seg: 24 }), sleeve, coat === 'gown' ? 'cape' : 'top');
        part(fore, revShell([[0.087, -FORE + 0.002], [0.09, -FORE - 0.012]], 0.016, { seg: 24 }), coat === 'gown' ? cuffM : trimM, coat === 'gown' ? 'topDark' : 'trim');
      } else if (!bareFore) {
        part(fore, revShell([[0.049, -FORE + 0.028], [0.052, -FORE - 0.004]], 0.016, { seg: 18 }), coat === 'plate' || coat === 'armor' ? metal : cuffM, coat === 'plate' || coat === 'armor' ? 'metal' : 'topDark');
        // A button on the outer side of the cuff
        if (coat === 'tunic' || coat === 'coat' || coat === 'blouse') button(fore, v3(sx * 0.0515, -FORE + 0.012, 0.012), v3(sx, 0, 0.3).normalize(), 0.0075, trimM);
      }
      const hand = group(fore, [0, -FORE + 0.005, 0]);
      part(hand, handGeo(sx, 1.05), skin, 'skin');
      const palm = group(hand, [0, -0.045, 0.004]);
      this.arms.push(arm);
      this.fores.push(fore);
      this.hands.push(palm);
      this.armBase.push(new THREE.Euler(0, 0, sx * 0.12));
      this.foreBase.push(-0.14);
    }
  }

  // ───────────── Head, face, hair, hats ─────────────

  private buildHead(o: Outfit, style: HairStyle, face: FaceKind, headK: number, M: Mats, skin: SpiritMaterial): THREE.Group {
    const kk = (this.kk = kaykitOf(o, style));
    const hs = (this.hs = headShapeKK());
    const fc = (this.fc = FACE_KK);
    const head = group(this.torso, [0, NECK_Y + 0.29 * headK, 0.012]);
    head.scale.setScalar(headK);
    this.c.head = head;
    // Head, face, ears: the original KayKit meshes. The nose is added separately: not for those wearing masks (it would poke
    // through the mask), and slightly shrunk for the young (shrunk from the nose root, so it does not leave the face)
    part(head, kaykitPart(kk, 'skin', hs)!, skin, 'skin');
    if (face !== 'none') {
      const nose = kaykitPart(kk, 'nose', hs)!;
      const ns = kk.young > 1 ? 0.8 : kk.young > 0 ? 0.9 : 1;
      if (ns < 1) {
        nose.computeBoundingBox();
        const b = nose.boundingBox!;
        const c = new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z);
        nose.translate(-c.x, -c.y, -c.z);
        nose.scale(ns, ns, ns);
        nose.translate(c.x, c.y, c.z);
      }
      part(head, blendIntoFace(kk, hs, nose, 0.03), skin, 'skin');
    }
    const at = (x: number, y: number, lift: number) => {
      const [th, lat] = hs.facing(x, y);
      return hs.at(PI / 2 - lat, th, lift);
    };
    this.foreheadLocal.copy(at(0, fc.foreheadY, 0.01));
    const faceA = group(head);
    faceA.position.copy(at(0, fc.eyeY - 0.08, 0));
    const eyesA: THREE.Object3D[] = [];
    for (const sx of [-1, 1]) {
      const e = group(head);
      e.position.copy(at(sx * fc.eyeX, fc.eyeY, 0.004));
      eyesA.push(e);
    }
    const mouthA = group(head);
    mouthA.position.copy(at(0, fc.mouthY, 0.004));
    this.faceAnchors = { face: faceA, eyes: eyesA, mouth: mouthA };

    this.buildFace(o, face, head, hs, M);
    this.buildHair(o, style, head, hs, M);
    this.buildHat(o, head, hs, M);
    return head;
  }

  /**
   * Face: the eyes, brows and nose are all KayKit's original meshes (small deep upright-oval eyes, short thick brows,
   * a round nose tip), with no whites, lashes or blush.
   * Personality is told apart by brow angle and height, how flat the eyes are, and mouth shape (FaceKind);
   * closing the eyes squashes the original eyes into a short line.
   */
  private buildFace(o: Outfit, face: FaceKind, head: THREE.Group, hs: HeadShape, M: Mats): void {
    const open = group(head);
    open.name = 'eyesOpen';
    const shut = group(head);
    shut.name = 'eyesShut';
    shut.visible = false;
    if (face === 'none') return;
    const elder = o.hat === 'beard';
    const kk = this.kk;
    const kid = kk.young > 1;
    const young = kk.young > 0;
    // The shapes on the face (the mouth) all share one vertex-color material and are merged into one mesh;
    // drawn on the head shape first, then moved onto the original's face (onFace)
    const fm = M.face();
    const decal = (parent: THREE.Object3D, pts: [number, number][], color: THREE.ColorRepresentation, lift: number) => part(parent, onFace(kk, hs, hs.decal(pts, 0, color, 2), lift), fm, null);
    const F = FACE_KIND[face];
    const eyeM = M.toon(mix(EYE_DARK, o.eye, 0.16), { rim: 0 });
    const fine = o.brows === 'fine';
    // Thin brows must be darkened more to be seen (a pink-haired brow with the usual darkening would be almost the same color as the skin)
    const browM = M.toon(elder ? mix(o.hair, 0x6a6258, 0.4) : fine ? mix(browColor(o.hair), 0x2a1422, 0.45) : browColor(o.hair), { rim: 0 });
    for (const sx of [-1, 1]) {
      // Eyes: the original's eyes. Adults shrink slightly (a little over a tenth of the head height);
      // the young do not shrink, and children get a bit bigger (about 12%). Widened, flattened and shifted up or down a little per the expression
      const e = kaykitEye(kk, hs, sx);
      const c = centerOf(e);
      const es = kid ? 1.08 : young ? 1 : 0.88;
      const h = (e.boundingBox!.max.y - e.boundingBox!.min.y) * es * F.eyeH;
      e.translate(-c.x, -c.y, -c.z);
      e.scale(es * F.eyeW, es * F.eyeH, 1);
      e.translate(c.x, c.y + F.eyeDY * hs.ry, c.z);
      part(open, e, eyeM, null);
      // Closed eyes: the same eye squashed into a short line at its lower edge, nudged slightly forward so it does not sink into the face
      const y0 = c.y - h * 0.22;
      const z = e.clone();
      z.translate(0, -y0, 0);
      z.scale(1.1, 0.16, 1);
      z.translate(0, y0, 0.003);
      part(shut, z, eyeM, null);
      // Brows: this head's original brows, first turned flat, then per the expression the outer end is raised or lowered
      // (F.browTilt) and the whole brow shifted up or down (F.browDY).
      // The original brows are thick and set low, which looks like glaring: adults get them raised a bit and shortened a
      // bit; the young get them thinner, shorter and higher; women's brow tails dip slightly
      const b = kaykitPart(kk, 'brow', hs, sx)!;
      const bc = centerOf(b);
      const flat = slantOf(b);
      b.translate(-bc.x, -bc.y, -bc.z);
      b.rotateZ(-flat);
      b.scale((young ? 0.7 : 0.86) * F.browL, (fine ? 0.56 : young ? 0.6 : 0.86) * F.browT, 1);
      b.rotateZ(sx * (fine ? -0.025 : F.browTilt) * 3);
      // The Rogue's and Mage's bangs cover the upper edge of the brows: the Rogue's brows go down a little,
      // and the Mage's are only raised a little, so they do not hide in the hair
      const up = kk.head === 'rogue' ? -0.008 : kk.head === 'mage' ? 0.004 : young ? 0.02 : 0.009;
      b.translate(bc.x, bc.y + up + F.browDY * hs.ry * 0.35, bc.z + 0.002);
      part(head, b, browM, null);
    }
    // Mouth: small, with the corners within the width of the nostrils
    const [, mlat] = hs.facing(0, this.fc.mouthY);
    if (face === 'cheer') {
      // A small open-mouth smile: flat upper edge, semicircular lower edge, with a bit of tongue color inside
      const w = 0.075;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 8; k++) pts.push([-w + (k / 8) * 2 * w, mlat + 0.012 + 0.008 * ((-w + (k / 8) * 2 * w) / w) ** 2]);
      for (let k = 1; k < 12; k++) {
        const a = (k / 12) * PI;
        pts.push([Math.cos(a) * w, mlat + 0.01 - Math.sin(a) * 0.06]);
      }
      decal(head, pts, MOUTH, 0.0015);
      decal(head, ellipse(0, mlat - 0.034, 0.042, 0.02, 12), mix(MOUTH, 0xe07080, 0.55), 0.0025);
    } else {
      const span = F.mouthW;
      const curve = F.mouthCurve;
      decal(head, stroke((t) => {
        const x = -span + t * span * 2;
        return [x, mlat - curve * (1 - (x / span) ** 2)];
      }, (t) => 0.03 * Math.sqrt(Math.sin(t * PI)) + 0.006, 14), MOUTH, 0.0015);
      // Lower lip: a faint arc below the mouth line (a bit warmer than the skin tone), so the mouth has some thickness
      const lw = span * 0.6;
      decal(head, stroke((t) => {
        const x = -lw + t * lw * 2;
        return [x, mlat - curve * 0.8 - 0.034 - 0.006 * (1 - (x / lw) ** 2)];
      }, (t) => 0.022 * Math.sin(t * PI), 10), mix(o.skin, MOUTH, 0.28), 0.001);
    }
  }

  /**
   * Hair has two layers: the bottom layer is a whole shell hugging the head (darker than the hair color,
   * its edge cut into short locks, covering the scalp), with bulky locks (hairLocks) piled on top.
   * Few, wide strands (ten to fourteen locks around short hair), a flat top with a slight S curve,
   * a width that varies from root to tip, and the tips tapering and flicking outward or inward;
   * the side edges are buried in the bottom layer, leaving dark grooves between locks. Light and dark come from large blocks
   * of top light, side and inner shade, so not every lock is equally bright.
   * Hair flow: the crown's whorl radiates outward, the bangs are split into several groups of different lengths,
   * the sides are combed back, and the tips at the back of the head flick outward; the elder's sides are a few locks curling
   * backward, interleaved with the upper and lower layers.
   * A ponytail or twin tail is one thick center plus a few thin strands hugging it, and the thin strands curve back to the
   * center before the end, so the tip closes into a natural point.
   */
  private buildHair(o: Outfit, style: HairStyle, head: THREE.Group, hs: HeadShape, M: Mats): void {
    if (style === 'none') return;
    // The bottom layer is darker than the hair color and the locks are the hair color (very dark hair is lightened a bit);
    // the bottom layer of white hair is a shadow color with a hint of gray-blue, so the locks can be told apart
    const hsl = col(o.hair).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
    // Rim light turned down: the sides of the locks are all slanted, and the default rim light would trace a white line
    // along the edge of every lock, making the whole head look like noodles
    const hair = M.toon(hsl.l < 0.25 ? new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l + 0.05, THREE.SRGBColorSpace).getHex() : o.hair, { rim: 0.1 });
    const hairBase = M.toon(hsl.l > 0.8 ? mix(o.hair, 0x6f80a4, 0.42) : shade(o.hair, 0.7), { rim: 0.1 });
    // With a helmet or hood the hair is flattened and must not poke out of the hat; the top of the head is covered and only
    // the ring below the brim shows, so the vertical segments are cut to 60% (the jagged tips rely on the horizontal segments, left unchanged)
    const under = o.hat === 'helm' || o.hat === 'hood';
    const HAT_MAX = 0.036;
    const flat = (off: (s: number, th: number) => number) => (under ? (s: number, th: number) => Math.min(off(s, th), HAT_MAX - 0.008) : off);
    // The bottom layer is mostly covered by the locks, so it needs few vertical segments; under a hat only the ring below
    // the brim shows, so the horizontal segments are reduced too
    const cap = (opts: CapOpts) => part(head, capShell(hs, under ? { ...opts, off: flat(opts.off), rows: Math.round((opts.rows ?? 11) * 0.6), cols: 48 } : { rows: 11, ...opts }), hairBase, 'hair');
    const crownPuff = (base: number, side: number) => (s: number, th: number) => 0.014 + base * (1 - s * s) * (0.75 + 0.25 * smoothstep(Math.abs(th), 0.3, 1.2)) + side * Math.sin(s * PI) * smoothstep(Math.abs(th), 0.8, 1.6);
    // The locks grow against the bottom layer: bed is the height of the bottom layer's outer surface at (φ, θ)
    const locks = (list: Lock[], L: (th: number) => number, off: (s: number, th: number) => number, fall: number | ((th: number) => number), fallIn: number | ((th: number) => number)) => {
      const f = flat(off);
      // Under a hat: the crown's whorl is entirely covered, so it is skipped; the locks' cross-section segments are reduced too
      if (under) list = list.filter((k) => k.phi0 > 0.1).map((k) => ({ ...k, tip: Math.max(k.tip ?? 0, 0.45) }));
      part(head, hairLocks(hs, list, { bed: (phi, th) => f(Math.min(1, phi / L(th)), th), fall, fallIn, max: under ? HAT_MAX : undefined, rows: under ? 7 : 9, cols: under ? 4 : 6 }), hair, 'hair');
    };
    const even = (n: number, a: number, b: number) => Array.from({ length: n }, (_, k) => (n === 1 ? (a + b) / 2 : a + ((b - a) * k) / (n - 1)));
    // Each lock's length and width has some randomness, and the same character builds the same every time
    let sd = 11;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647) - 0.5;
    const sides = (ths: number[], f: (th: number, sx: number, k: number) => Lock): Lock[] => [-1, 1].flatMap((sx) => ths.map((a, k) => f(sx * a, sx, k)));
    const sgn = (th: number) => Math.sign(Math.sin(th)) || 1;
    // The crown's whorl: swirls out from the center of the top of the head and radiates outward,
    // so even looking down from above (the game camera) the crown has hair flow
    const whorl = (n: number, len: number, thick: number): Lock[] => even(n, 0, 2 * PI * (1 - 1 / n)).map((th, k) => ({ th: th + 0.5, phi0: 0.04, L: len + 0.08 * (k % 2), w: 0.1, thick, sweep: 0.8, lift: 0.004 + 0.004 * (k % 2) }));
    // Twin tails, ponytail: one full bundle of hair, thickest in the middle and tapering to a point only once at the end;
    // a few shallow grooves that follow the hair flow and twist slightly separate it into strands
    const bundle = (parent: THREE.Object3D, spine: THREE.Vector3[], w: number, grooves: number) => {
      part(parent, tube(spine, (t) => {
        const r = w * Math.sqrt(Math.min(1, t * 3.2 + 0.3)) * (1 + 0.16 * Math.sin(Math.min(1, t * 1.3) * PI)) * (1 - 0.95 * Math.pow(smoothstep(t, 0.58, 1), 1.25));
        return [r, r * 0.86];
      }, { segs: 26, radial: 20, ripple: (t, a) => 0.09 * Math.cos(grooves * a + t * 2.2) * smoothstep(t, 0.06, 0.26) * (1 - smoothstep(t, 0.78, 1)) }), hair, 'hair');
    };
    // KayKit's original hair: the whole head of hair is replaced with the character's hair color (the original palette's
    // top-to-bottom gradient is kept), then small extras are added by hairstyle (sticking-up tuft, twin tails, ponytail)
    const kk = this.kk;
    if (kk.hair) {
      part(head, kaykitPart(kk, 'hair', hs)!, hair, 'hair');
      // The bundle at the back of the Mage's head and the hair tie: kept only for those who tie their hair (the Rogue's earring is not kept)
      if (kk.tail) {
        part(head, kaykitPart(kk, 'tail', hs)!, hair, 'hair');
        part(head, kaykitPart(kk, 'trim', hs)!, M.toon(o.trim, { surface: 'metal' }), 'trim');
      }
      const off = kaykitHairOff(kk, hs);
      if (style === 'messy') {
        // A flattened tuft of sticking-up hair on top: grows out of the hair and curves backward
        const p0 = hs.at(0.3, 0.25, off(0.3, 0.25) - 0.012);
        const n0 = hs.normal(0.3, 0.25);
        const p1 = hs.at(0.1, 0.3, off(0.1, 0.3) + 0.05);
        const p2 = hs.at(0.25, PI - 0.4, off(0.25, PI - 0.4) + 0.08).add(v3(0, 0.02, 0));
        part(head, tube([p0.clone().addScaledVector(n0, -0.03), p0, p1, p2], (t) => {
          const r = 0.036 * Math.pow(1 - t, 0.8) * Math.sqrt(Math.min(1, t * 4 + 0.15));
          return [r, r * 0.38];
        }, { segs: 12, radial: 10, side: v3(1, 0, 0) }), hair, 'hair');
      } else if (style === 'twintails') {
        const tie = M.toon(o.trim, { surface: 'metal' });
        for (const sx of [-1, 1]) {
          const root = hs.at(1.15, sx * 1.9, off(1.15, sx * 1.9) - 0.012);
          const tg = group(head, [root.x, root.y, root.z]);
          // Hair tips: a full big bundle going outward then downward, the end hooking slightly inward, tapering to a point once
          bundle(tg, [v3(0, 0, 0), v3(sx * 0.08, -0.04, -0.03), v3(sx * 0.15, -0.16, -0.03), v3(sx * 0.16, -0.32, 0.0), v3(sx * 0.12, -0.45, 0.03), v3(sx * 0.07, -0.52, 0.05)], 0.095, 5);
          part(tg, new THREE.TorusGeometry(0.052, 0.018, 10, 24), tie, 'trim', [sx * 0.03, -0.02, -0.01], [PI / 2 - 0.2, sx * 0.5, 0]);
          part(tg, new THREE.SphereGeometry(0.026, 12, 10), tie, 'trim', [sx * 0.005, 0.022, 0.03]);
          this.tails.push(tg);
        }
      } else if (style === 'long') {
        // Elda: the original's hair only reaches the chin, so a piece of long hair reaching below the shoulders is attached
        // under it at the back, split into five big locks
        const L = angleCurve([[1.55, 2.6], [1.9, 3.2], [2.4, 3.8], [PI, 4.0]]);
        const bed = (s: number, th: number) => {
          const h = off(s * L(th), th);
          return h > 0.012 ? Math.min(0.036, h - 0.008) : 0.036;
        };
        const fall = PI / 2 + 0.1;
        const fallIn = fallInBy(0.06, 0.1);
        part(head, capShell(hs, { L, off: bed, inner: 0.004, from: 0.5, a0: 1.55, a1: 2 * PI - 1.55, fall, fallIn, fallThick: 0.045, tufts: 10, notch: 0.12, groove: 0.3, jitter: 0.3, seed: 8, cols: 48, rows: 14 }), hairBase, 'hair');
        part(head, hairLocks(hs, [
          ...even(5, 2.2, 2 * PI - 2.2).map((th, k): Lock => ({ th, phi0: 1.7, L: L(th) + 0.1 + rnd() * 0.08, w: 0.095, thick: 0.05, sweep: 0.03 * sgn(th), bend: k % 2 ? 0.03 : -0.03, lift: (k % 2) * 0.008, hold: 0.82 })),
          ...sides([1.8], (th, sx) => ({ th, phi0: 1.8, L: L(th) + 0.06, w: 0.1, thick: 0.04, sweep: sx * 0.06, bend: sx * 0.03, hold: 0.8 })),
        ], { bed: (phi, th) => bed(Math.min(1, phi / L(th)), th), fall, fallIn, rows: 9 }), hair, 'hair');
      }
      return;
    }
    switch (style) {
      case 'messy': {
        // Hero, children: the bangs split into five pieces swept to the right; the temple pieces hug the head,
        // a thin sideburn in front of the ear, the top edge of the ear showing; the tips at the back of the head flick outward
        const L = angleCurve([[0, 1.24], [0.4, 1.3], [0.7, 1.24], [0.92, 1.46], [1.1, 1.6], [1.45, 1.66], [1.8, 1.68], [2.05, 1.95], [2.35, 2.2], [PI, 2.35]]);
        const off = crownPuff(0.02, 0.004);
        const fall = fallBy(PI / 2 + 0.08);
        const fallIn = fallInBy(0.05, 0.28);
        cap({ L: (th) => L(th) - 0.05, off, tufts: 13, notch: 0.08, groove: 0.3, jitter: 0.3, phase: 0.08, seed: 5, fall, fallIn, fallThick: 0.04 });
        locks([
          // Five bang pieces of different widths, swept to the right (-x) with a slight S curve, longest in the middle, the tips flicking up slightly
          ...([[-0.72, 0.12, 0.085], [-0.38, 0.24, 0.1], [-0.04, 0.3, 0.112], [0.3, 0.2, 0.096], [0.64, 0.08, 0.08]] as const).map(([th, dl, w], k): Lock => ({ th, phi0: 0.24, L: L(th) + dl, w, thick: 0.05, sweep: -0.16, bend: k % 2 ? 0.05 : -0.04, flick: 0.018, lift: (k % 2) * 0.008 })),
          // Temple: a piece combed back, hugging the head
          ...sides([0.98], (th, sx) => ({ th, phi0: 0.34, L: L(th) + 0.06, w: 0.1, thick: 0.03, sweep: sx * 0.26, bend: sx * 0.04, lift: 0.004 })),
          // Above the ear: a piece combed back, its tip stopping at the top edge of the ear
          ...sides([1.62], (th, sx) => ({ th, phi0: 0.36, L: L(th) + 0.02, w: 0.1, thick: 0.03, sweep: sx * 0.2, bend: sx * 0.03, flick: 0.008, lift: 0.008 })),
          // Sideburn in front of the ear: thin, running down along the cheek and tapering to a round point
          ...sides([1.24], (th, sx) => ({ th, phi0: 1.1, L: 2.02, w: 0.05, thick: 0.018, sweep: -sx * 0.04, root: 0.9, lift: 0.002 })),
          // Five pieces at the back of the head: tips flicking outward
          ...even(5, 2.15, 2 * PI - 2.15).map((th, k): Lock => ({ th, phi0: 0.28, L: L(th) + 0.12 + rnd() * 0.1, w: 0.1 + rnd() * 0.03, thick: 0.05, sweep: 0.06 * sgn(th), bend: k % 2 ? 0.04 : -0.04, flick: 0.032, lift: (k % 2) * 0.008 })),
          ...whorl(4, 0.95, 0.04),
        ], L, off, fall, fallIn);
        // A flattened tuft of sticking-up hair on top: curving backward along the crown, an arc seen from the side, so it does not look like a horn
        const p0 = hs.at(0.32, 0.25, 0.05);
        const n0 = hs.normal(0.32, 0.25);
        const p1 = hs.at(0.12, 0.3, 0.11);
        const p2 = hs.at(0.25, PI - 0.4, 0.14).add(v3(0, 0.02, 0));
        part(head, tube([p0.clone().addScaledVector(n0, -0.02), p0, p1, p2], (t) => {
          const r = 0.038 * Math.pow(1 - t, 0.8) * Math.sqrt(Math.min(1, t * 4 + 0.15));
          return [r, r * 0.38];
        }, { segs: 12, radial: 10, side: v3(1, 0, 0) }), hair, 'hair');
        break;
      }
      case 'short': {
        // Short side-parted hair: bangs combed to one side, temples hugging the head, a sideburn in front of the ear,
        // the top edge of the ear showing, the back of the head cut short with the tips lying flat
        const L = angleCurve([[0, 1.12], [0.45, 1.17], [0.75, 1.12], [0.95, 1.42], [1.1, 1.56], [1.45, 1.62], [1.8, 1.64], [2.05, 1.9], [2.35, 2.08], [PI, 2.2]]);
        const off = crownPuff(0.018, 0.004);
        const fall = fallBy(PI / 2 + 0.08);
        const fallIn = fallInBy(0.05, 0.28);
        cap({ L: (th) => L(th) - 0.05, off, tufts: 15, notch: 0.07, groove: 0.3, jitter: 0.3, phase: 0.1, seed: 3, fall, fallIn, fallThick: 0.036 });
        locks([
          // Five bang pieces combed to one side, with a slight S curve
          ...([[-0.66, 0.08, 0.09], [-0.33, 0.14, 0.1], [0, 0.16, 0.105], [0.33, 0.12, 0.095], [0.66, 0.06, 0.085]] as const).map(([th, dl, w], k): Lock => ({ th, phi0: 0.22, L: L(th) + dl, w, thick: 0.044, sweep: 0.22, curl: 0.05, bend: k % 2 ? 0.04 : -0.03, flick: 0.01, lift: (k % 2) * 0.007 })),
          ...sides([0.98], (th, sx) => ({ th, phi0: 0.34, L: L(th) + 0.05, w: 0.1, thick: 0.028, sweep: sx * 0.24, bend: sx * 0.04, lift: 0.004 })),
          ...sides([1.62], (th, sx) => ({ th, phi0: 0.36, L: L(th) + 0.02, w: 0.1, thick: 0.028, sweep: sx * 0.2, bend: sx * 0.03, lift: 0.008 })),
          ...sides([1.24], (th, sx) => ({ th, phi0: 1.1, L: 1.98, w: 0.05, thick: 0.016, sweep: -sx * 0.04, root: 0.9, lift: 0.002 })),
          ...even(5, 2.1, 2 * PI - 2.1).map((th, k): Lock => ({ th, phi0: 0.28, L: L(th) + 0.08 + rnd() * 0.06, w: 0.1 + rnd() * 0.025, thick: 0.044, sweep: 0.05 * sgn(th), bend: k % 2 ? 0.03 : -0.03, flick: 0.016, lift: (k % 2) * 0.007 })),
          ...whorl(4, 0.9, 0.036),
        ], L, off, fall, fallIn);
        break;
      }
      case 'elder': {
        // Bald on top with a high forehead; two layers of fluffy white hair from the sides to the back of the head,
        // the upper edge hugging the scalp and the lower edge curling backward along the side of the head, with a gray-blue shadow underneath
        const L = angleCurve([[0.75, 1.5], [1.1, 1.72], [1.6, 1.86], [2.3, 2.25], [PI, 2.38]]);
        // Hugs the original's scalp (the Barbarian's head is a bit larger than the sampled head shape,
        // so growing by the head shape would bury the pieces in the scalp one by one)
        const scalp = kaykitOff(this.kk, 'skin', hs);
        // The ears are also on the original's face, so a hit on an ear does not count (at most 2 cm)
        const off = (s: number, th: number) => Math.min(0.02, scalp(s * L(th), th)) + 0.003 + 0.008 * smoothstep(s, 0.6, 0.92) * (1 - 0.3 * smoothstep(s, 0.9, 1));
        const fall = fallBy(PI / 2 + 0.08);
        const fallIn = fallInBy(0.05, 0.28);
        cap({ L, off, tufts: 16, notch: 0.1, groove: 0.35, jitter: 0.3, seed: 9, from: 0.6, a0: 0.75, a1: 2 * PI - 0.75, cols: 72, rows: 9, fall, fallIn, fallThick: 0.05 });
        locks([
          // Lower layer: long, round-tipped, hugging the head
          ...even(10, 0.95, 2 * PI - 0.95).map((th, k): Lock => ({ th, phi0: 0.57 * L(th), L: L(th) + 0.1 + rnd() * 0.08, w: 0.085 + rnd() * 0.02, thick: 0.02, sweep: 0.16 * sgn(th), bend: k % 2 ? 0.04 : -0.04, flick: -0.006, tip: 0.3, root: 0.25, lift: (k % 2) * 0.004 })),
          // Upper layer: a bit shorter, offset by half a piece, covering the seams of the lower layer
          ...even(9, 1.1, 2 * PI - 1.1).map((th, k): Lock => ({ th, phi0: 0.6 * L(th), L: L(th) * 0.9, w: 0.08, thick: 0.018, sweep: 0.14 * sgn(th), flick: -0.004, tip: 0.35, root: 0.25, lift: 0.004 + (k % 2) * 0.002 })),
          // Above both temples: two locks curling backward, hugging the side of the head with the tips turning inward,
          // pressed over the upper and lower layers
          ...sides([1.05, 1.42], (th, sx, k) => ({ th, phi0: 0.6 * L(th), L: L(th) * (0.97 - 0.05 * k), w: 0.075, thick: 0.018, sweep: sx * 0.46, curl: sx * 0.3, flick: -0.014, tip: 0.2, root: 0.3, lift: 0.006 + (k % 2) * 0.002 })),
        ], L, off, fall, fallIn);
        break;
      }
      case 'twintails': {
        // Mila: brow-length bangs in five wide pieces; the sides are tied back into twin tails with the ears showing,
        // a lock of side hair on each side of the face hanging to the cheek (its tip hooking toward the face),
        // and the hair at the back of the head reaching the nape
        const L = angleCurve([[0, 1.3], [0.35, 1.34], [0.72, 1.26], [0.95, 1.52], [1.3, 1.66], [1.75, 1.68], [2.1, 1.95], [2.5, 2.05], [PI, 2.1]]);
        const off = crownPuff(0.024, 0.006);
        const fall = PI / 2 + 0.05;
        const fallIn = fallInBy(0.04, 0.26);
        cap({ L: (th) => L(th) - 0.06, off, tufts: 12, notch: 0.08, groove: 0.35, jitter: 0.25, phase: 0.02, fall, fallIn, fallThick: 0.04, seed: 4 });
        locks([
          // Five brow-length bang pieces, wide and alternating in length, the tips stopping above the brows
          ...([[-0.62, 0.06, 0.12], [-0.31, 0.1, 0.125], [0, 0.07, 0.13], [0.31, 0.1, 0.125], [0.62, 0.06, 0.12]] as const).map(([th, dl, w], k): Lock => ({ th, phi0: 0.24, L: L(th) + dl, w, thick: 0.044, sweep: -th * 0.12, bend: k % 2 ? 0.03 : -0.03, flick: 0.012, lift: (k % 2) * 0.007 })),
          // Side hair on each side of the face hanging to the cheek, the tips hooking toward the face
          ...sides([0.98], (th, sx) => ({ th, phi0: 0.4, L: 2.25, w: 0.07, thick: 0.04, sweep: -sx * 0.04, curl: -sx * 0.14, bend: sx * 0.03, lift: 0.008 })),
          // Both sides combed back into the tails
          ...sides([1.4, 1.8], (th, sx, k) => ({ th, phi0: 0.32, L: L(th) + 0.04, w: 0.1, thick: 0.03, sweep: sx * 0.3, bend: sx * 0.03, lift: (k % 2) * 0.006 })),
          ...even(5, 2.15, 2 * PI - 2.15).map((th, k): Lock => ({ th, phi0: 0.28, L: L(th) + 0.1 + rnd() * 0.06, w: 0.1 + rnd() * 0.03, thick: 0.046, sweep: 0.06 * sgn(th), bend: k % 2 ? 0.04 : -0.04, flick: 0.018, lift: (k % 2) * 0.008 })),
          ...whorl(4, 0.92, 0.038),
        ], L, off, fall, fallIn);
        const tie = M.toon(o.trim, { surface: 'metal' });
        for (const sx of [-1, 1]) {
          const root = hs.at(1.2, sx * 1.95, 0.05);
          const tg = group(head, [root.x, root.y, root.z]);
          // Hair tips: a full big bundle going outward then downward, the end hooking slightly inward, tapering to a point once
          bundle(tg, [v3(0, 0, 0), v3(sx * 0.08, -0.04, -0.03), v3(sx * 0.15, -0.16, -0.03), v3(sx * 0.16, -0.32, 0.0), v3(sx * 0.12, -0.45, 0.03), v3(sx * 0.07, -0.52, 0.05)], 0.1, 5);
          // Hair tie: a gold ring with a small bead
          part(tg, new THREE.TorusGeometry(0.052, 0.018, 10, 24), tie, 'trim', [sx * 0.03, -0.02, -0.01], [PI / 2 - 0.2, sx * 0.5, 0]);
          part(tg, new THREE.SphereGeometry(0.026, 12, 10), tie, 'trim', [sx * 0.005, 0.022, 0.03]);
          this.tails.push(tg);
        }
        break;
      }
      case 'bob': {
        // Ear-length bob: bangs cut straight, the tips at the sides and back of the head turning inward
        const L = angleCurve([[0, 1.3], [0.4, 1.36], [0.8, 1.42], [1.1, 2.2], [1.6, 2.26], [PI, 2.34]]);
        const off = crownPuff(0.024, 0.01);
        const fall = PI / 2 + 0.05;
        const fallIn = fallInBy(0.05, 0.32);
        cap({ L: (th) => L(th) - 0.04, off, tufts: 24, notch: 0.08, groove: 0.3, jitter: 0.25, phase: 0.05, fall, fallIn, fallThick: 0.05, seed: 6 });
        locks([
          // Six straight-cut bang pieces
          ...even(6, -0.8, 0.8).map((th, k): Lock => ({ th, phi0: 0.24, L: L(th) + 0.05 + rnd() * 0.03, w: 0.085 + rnd() * 0.015, thick: 0.042, sweep: rnd() * 0.05, bend: k % 2 ? 0.025 : -0.025, tip: 0.45, lift: (k % 2) * 0.007 })),
          // Nine pieces at the sides and back of the head, the tips turning inward
          ...even(9, 1.08, 2 * PI - 1.08).map((th, k): Lock => ({ th, phi0: 0.28, L: L(th) + 0.06 + rnd() * 0.04, w: 0.1 + rnd() * 0.025, thick: 0.048, sweep: 0.04 * sgn(th), bend: k % 2 ? 0.03 : -0.03, tip: 0.4, flick: -0.014, lift: (k % 2) * 0.008 })),
          ...whorl(4, 0.9, 0.036),
        ], L, off, fall, fallIn);
        break;
      }
      case 'long': {
        // Elda: center-parted bangs combed to both sides, a long lock of side hair on each side of the face hanging past the
        // shoulder, and the long hair at the back split into five big locks
        const L = angleCurve([[0, 1.26], [0.35, 1.32], [0.75, 1.4], [1.1, 2.3], [1.55, 2.25], [1.95, 2.9], [2.3, 3.9], [PI, 4.3]]);
        const off = crownPuff(0.024, 0.01);
        const fall = PI / 2 + 0.05;
        const fallIn = fallInBy(0.03, 0.06);
        cap({ L: (th) => L(th) - 0.08, off, tufts: 20, notch: 0.12, groove: 0.35, jitter: 0.3, phase: 0.02, fall, fallIn, fallThick: 0.05, seed: 8, rows: 24 });
        locks([
          // Center-parted bangs combed to both sides
          ...sides([0.14, 0.42, 0.7], (th, sx, k) => ({ th, phi0: 0.2, L: L(th) + 0.05 + 0.03 * k, w: 0.08, thick: 0.042, sweep: sx * 0.16, curl: sx * 0.05, bend: sx * 0.03, lift: (k % 2) * 0.007 })),
          ...sides([0.98], (th, sx) => ({ th, phi0: 0.4, L: 2.8, w: 0.07, thick: 0.046, sweep: sx * 0.02, curl: -sx * 0.06, bend: sx * 0.03, lift: 0.01, hold: 0.8 })),
          ...sides([1.32, 1.72], (th, sx, k) => ({ th, phi0: 0.32, L: L(th) + 0.08, w: 0.095, thick: 0.046, sweep: sx * 0.08, bend: sx * 0.035, lift: (k % 2) * 0.007, hold: 0.75 })),
          // At the back: five big locks (wide, thick, with thickness all the way down), the dark bottom layer showing between locks
          ...even(5, 2.2, 2 * PI - 2.2).map((th, k): Lock => ({ th, phi0: 0.3, L: L(th) + 0.12 + rnd() * 0.08, w: 0.092, thick: 0.058, sweep: 0.03 * sgn(th), bend: k % 2 ? 0.03 : -0.03, lift: (k % 2) * 0.008, hold: 0.82 })),
          ...whorl(4, 0.92, 0.036),
        ], L, off, fall, fallIn);
        break;
      }
      case 'tied': {
        // Herder: hair combed back and tied in a ponytail at the back of the head, hugging the head, with the ears showing;
        // a few short locks in front of the forehead show from under the headband
        const L = angleCurve([[0, 1.1], [0.5, 1.14], [0.8, 1.1], [1.0, 1.42], [1.2, 1.58], [1.5, 1.62], [1.8, 1.64], [2.1, 1.88], [2.4, 1.96], [PI, 2.05]]);
        const off = crownPuff(0.016, 0.004);
        const fall = fallBy(PI / 2 + 0.08);
        const fallIn = fallInBy(0.05, 0.26);
        cap({ L: (th) => L(th) - 0.04, off, tufts: 16, notch: 0.07, groove: 0.3, jitter: 0.3, seed: 12, fall, fallIn, fallThick: 0.036 });
        locks([
          ...even(4, -0.56, 0.56).map((th, k): Lock => ({ th, phi0: 0.26, L: L(th) + 0.08 + rnd() * 0.06, w: 0.09, thick: 0.022, sweep: rnd() * 0.1, bend: k % 2 ? 0.03 : -0.03, lift: (k % 2) * 0.005 })),
          ...sides([1.0, 1.5], (th, sx, k) => ({ th, phi0: 0.3, L: L(th) + 0.04, w: 0.1, thick: 0.022, sweep: sx * 0.3, bend: sx * 0.03, lift: (k % 2) * 0.005 })),
          ...sides([1.24], (th, sx) => ({ th, phi0: 1.1, L: 1.95, w: 0.046, thick: 0.014, sweep: -sx * 0.03, root: 0.9, lift: 0.002 })),
          ...even(5, 2.15, 2 * PI - 2.15).map((th, k): Lock => ({ th, phi0: 0.26, L: L(th) + 0.04, w: 0.1, thick: 0.022, sweep: -0.14 * sgn(th), lift: (k % 2) * 0.005 })),
        ], L, off, fall, fallIn);
        // The ponytail behind the head: tied from the back of the head and hanging down the back
        const root = hs.at(1.35, PI, 0.035);
        const tg = group(head, [root.x, root.y, root.z]);
        bundle(tg, [v3(0, 0.02, 0.02), v3(0, -0.06, -0.06), v3(0, -0.22, -0.075), v3(0, -0.38, -0.04), v3(0, -0.46, 0.0)], 0.074, 4);
        part(tg, new THREE.TorusGeometry(0.04, 0.014, 10, 20), M.toon(o.trim), 'trim', [0, -0.04, -0.04], [PI / 2 - 0.9, 0, 0]);
        this.tails.push(tg);
        break;
      }
    }
  }

  private buildHat(o: Outfit, head: THREE.Group, hs: HeadShape, M: Mats): void {
    switch (o.hat) {
      case 'helm': {
        const metalC = o.helm === 'sallet' ? 0xbcc2d0 : 0x9a9aa8;
        const metal = M.toon(metalC, { surface: 'metal', spec: 0.2 });
        const trim = M.toon(o.trim, { surface: 'metal' });
        if (o.helm === 'sallet') {
          // Knight's helmet: a round dome, a nape guard flaring outward, a gold edging around the lower rim; a blue plume on top
          const L = angleCurve([[0, 1.06], [0.6, 1.14], [1.0, 1.36], [1.5, 1.56], [2.2, 1.92], [PI, 2.02]]);
          part(head, capShell(hs, { L, off: (s) => 0.052 + 0.012 * (1 - s), inner: 0.03, fall: PI / 2 + 0.1, fallIn: -0.16, fallThick: 0.026, cols: 60, rows: 12 }), metal, 'hat');
          // Binding on the helmet rim: a thin ring, darker than the gold ornament, just edging the rim
          part(head, capShell(hs, { L: (th) => L(th) + 0.012, from: 0.95, off: () => 0.062, inner: 0.045, fall: PI / 2 + 0.1, fallIn: -0.16, fallThick: 0.02, cols: 72, rows: 2 }), M.toon(mix(o.trim, metalC, 0.45), { surface: 'metal' }), 'trim');
          // Plume: a piece along the midline of the top of the head, its upper edge cut into feather tips and swept backward
          const Ocrest: THREE.Vector3[][] = [];
          const Icrest: THREE.Vector3[][] = [];
          const R = 8;
          const Cn = 26;
          for (let i = 0; i <= R; i++) {
            Ocrest.push([]);
            Icrest.push([]);
          }
          for (let j = 0; j <= Cn; j++) {
            const u = j / Cn;
            const psi = -0.35 + u * 1.9;
            const phi = Math.abs(psi);
            const th = psi < 0 ? 0 : PI;
            const base = hs.at(phi, th, 0.058);
            const n = hs.normal(phi, th);
            const tuft = 1 - Math.abs(2 * ((u * 7) % 1) - 1);
            const h = (0.05 + 0.11 * Math.sin(Math.min(1, u * 1.1) * PI)) * (0.72 + 0.28 * Math.pow(tuft, 0.6));
            for (let i = 0; i <= R; i++) {
              const v = i / R;
              const p = base.clone().addScaledVector(n, h * v - 0.02).add(v3(0, 0, -0.07 * v * v));
              const w = 0.022 * (1 - v * 0.85) + 0.002;
              Ocrest[i].push(p.clone().add(v3(w, 0, 0)));
              Icrest[i].push(p.clone().add(v3(-w, 0, 0)));
            }
          }
          part(head, shellGrid(Ocrest, Icrest, false), M.toon(o.cape ?? o.trim), 'cape');
        } else {
          // Wide-brim iron helmet: a round dome + a wide brim sloping down, with a ring of rivets where the brim meets the dome
          part(head, capShell(hs, { L: () => 1.12, off: (s) => 0.068 + 0.02 * (1 - s * s), inner: 0.03, cols: 64, rows: 14 }), metal, 'hat');
          const rim = hs.at(1.12, 0, 0.068);
          const rr = Math.hypot(rim.x, rim.z);
          const y0 = rim.y;
          part(head, revShell([[rr - 0.01, y0 + 0.012], [rr + 0.07, y0 - 0.02], [rr + 0.15, y0 - 0.06], [rr + 0.165, y0 - 0.075]], 0.016, { seg: 48, zs: hs.rz / hs.rx }), metal, 'hat');
          const rg = new THREE.SphereGeometry(1, 10, 8, 0, PI * 2, 0, PI / 2);
          for (let k = 0; k < 12; k++) {
            const th = (k / 12) * 2 * PI;
            const p = hs.at(1.02, th, 0.086);
            const m = part(head, rg.clone(), trim, 'trim', [p.x, p.y, p.z], [0, 0, 0], [0.012, 0.007, 0.012]);
            m.quaternion.setFromUnitVectors(v3(0, 1, 0), hs.normal(1.02, th));
          }
          // The small point on top
          const tp = hs.at(0, 0, 0.085);
          part(head, new THREE.ConeGeometry(0.022, 0.05, 12), trim, 'trim', [tp.x, tp.y + 0.02, tp.z]);
        }
        break;
      }
      case 'hood': {
        // Rim light turned down: the hood is one large slanted surface, and the default rim light would light a faint white
        // line along the hood's outer edge
        const hood = M.toon(o.cape ?? o.topDark, { rim: 0.03 });
        const lining = M.toon(shade(o.cape ?? o.topDark, 0.55), { rim: 0 });
        const L = angleCurve([[0, 1.02], [0.5, 1.12], [0.85, 1.5], [1.15, 2.3], [1.6, 2.45], [PI, 2.5]]);
        part(head, capShell(hs, { L, off: (s) => 0.058 + 0.018 * Math.sin(s * PI * 0.8), inner: 0.04, fall: PI / 2 + 0.1, fallIn: -0.2, fallThick: 0.026, tufts: 0, cols: 72, rows: 16 }), hood, 'hat');
        part(head, capShell(hs, { L: (th) => L(th) - 0.02, from: 0.72, off: () => 0.045, inner: 0.036, fall: PI / 2 + 0.1, fallIn: -0.2, fallThick: 0.01, cols: 72, rows: 8 }), lining, 'cloth');
        // The point behind the hood: hanging down against the back of the head
        const b = hs.at(1.0, PI, 0.05);
        part(head, tube([b.clone().add(v3(0, 0.02, 0.05)), b.clone().add(v3(0, -0.04, -0.04)), b.clone().add(v3(0, -0.16, -0.07))], (t) => {
          const r = 0.06 * (1 - t) + 0.004;
          return [r, r * 0.75];
        }, { segs: 10, radial: 12 }), hood, 'hat');
        break;
      }
      case 'band': {
        // A cloth headband across the forehead, knotted at the back of the head with two tails hanging down
        const band = M.toon(o.trim);
        // Goes around against the outer surface of the original hair (when there is no original hair, it still sits some distance from the scalp)
        const hairOff = this.kk.hair ? kaykitHairOff(this.kk, hs) : () => 0.06;
        const Lb = angleCurve([[0, 1.02], [1.2, 1.2], [PI, 1.4]]);
        const bo = (th: number) => Math.max(0.03, hairOff(Lb(th) * 0.92, th)) + 0.012;
        part(head, capShell(hs, { L: Lb, from: 0.84, off: (_s, th) => bo(th), inner: (th) => bo(th) - 0.03, cols: 80, rows: 4 }), band, 'trim');
        const k = hs.at(1.25, PI, bo(PI) + 0.008);
        part(head, new THREE.SphereGeometry(0.03, 12, 10), band, 'trim', [k.x, k.y, k.z]);
        for (const sx of [-1, 1]) part(head, tube([k.clone(), k.clone().add(v3(sx * 0.04, -0.08, -0.04)), k.clone().add(v3(sx * 0.06, -0.2, -0.05))], (t) => [0.022 * (1 - t * 0.4), 0.005], { segs: 10, radial: 10, side: v3(1, 0, 0) }), band, 'trim');
        break;
      }
      case 'wizard': {
        // Traveler's soft hat (an option in old data, no character uses it)
        const hat = M.toon(o.topDark);
        part(head, capShell(hs, { L: () => 1.05, off: () => 0.07, inner: 0.03, cols: 48, rows: 10 }), hat, 'hat');
        const tp = hs.at(0, 0, 0.07);
        part(head, tube([tp.clone(), tp.clone().add(v3(0, 0.15, -0.05)), tp.clone().add(v3(0, 0.22, -0.18))], (t) => {
          const r = 0.2 * (1 - t) + 0.01;
          return [r, r];
        }, { segs: 12, radial: 20 }), hat, 'hat');
        break;
      }
      case 'beard': {
        // The KayKit Barbarian's beard (original mesh), changed to the character's hair color
        if (this.kk.head === 'barbarian') {
          part(head, kaykitPart(this.kk, 'beard', hs)!, M.toon(o.hair), 'beard');
          break;
        }
        // Beard: grows from the sideburns along the jaw, starting below the mouth at the front with the cheeks showing;
        // puffed out below the chin with the lower edge cut into locks; and an upturned handlebar mustache on the upper lip
        const hair = M.toon(o.hair);
        const O: THREE.Vector3[][] = [];
        const I: THREE.Vector3[][] = [];
        const R = 16;
        const C = 40;
        for (let i = 0; i <= R; i++) {
          O.push([]);
          I.push([]);
        }
        for (let j = 0; j <= C; j++) {
          const th = -1.45 + (j / C) * 2.9;
          const u = ((j / C) * 9) % 1;
          const tuft = 1 - Math.abs(2 * u - 1);
          const center = 1 - Math.abs(th) / 1.45;
          const latTop = -0.58 + 0.4 * smoothstep(Math.abs(th), 0.3, 1.45);
          const latBot = -1.15;
          const drop = (0.07 + 0.15 * center * center) * (0.62 + 0.38 * Math.pow(tuft, 0.7));
          for (let i = 0; i <= R; i++) {
            const v = i / R;
            const lat = latTop + (latBot - latTop) * Math.min(1, v / 0.7);
            const phi = PI / 2 - lat;
            const n = hs.normal(phi, th);
            const p = hs.point(phi, th);
            const extra = Math.max(0, v - 0.7) / 0.3;
            const off = 0.012 + 0.045 * Math.sin(Math.min(1, v * 1.4) * PI * 0.6) * (0.55 + 0.45 * center);
            const q = p.clone().addScaledVector(n, off).add(v3(0, -drop * extra, 0.04 * extra * center));
            O[i].push(q);
            I[i].push(p.clone().addScaledVector(n, -0.01).add(v3(0, -drop * extra, 0.012 * extra * center)));
          }
        }
        part(head, shellGrid(O, I, false), hair, 'beard');
        for (const sx of [-1, 1]) {
          const a = hs.at(PI / 2 + 0.37, sx * 0.02, 0.03);
          const b = hs.at(PI / 2 + 0.43, sx * 0.26, 0.04);
          const cpt = hs.at(PI / 2 + 0.36, sx * 0.5, 0.036);
          part(head, tube([a, b, cpt], (t) => {
            const r = 0.036 * Math.sin(Math.min(1, t * 1.4 + 0.25) * PI * 0.5) * (1 - t * 0.85) + 0.004;
            return [r, r * 0.75];
          }, { segs: 12, radial: 12 }), hair, 'beard');
        }
        break;
      }
    }
  }

  // ───────────── Cape ─────────────

  private buildCape(o: Outfit, kind: CapeKind, M: Mats): void {
    const mat = M.toon(o.cape!);
    const pivot = v3(0, NECK_Y - 0.01, -0.06);
    const g = group(this.torso, [pivot.x, pivot.y, pivot.z]);
    const spec = {
      long: { W: 1.3, yBot: -0.36, rTop: 0.12, rSide: 0.2, rBot: 0.3, tufts: 0 },
      cloak: { W: 1.95, yBot: -0.4, rTop: 0.12, rSide: 0.235, rBot: 0.34, tufts: 0 },
      capelet: { W: 1.5, yBot: 0.08, rTop: 0.11, rSide: 0.2, rBot: 0.25, tufts: 0 },
      shawl: { W: 2.65, yBot: 0.2, rTop: 0.11, rSide: 0.24, rBot: 0.29, tufts: 14 },
    }[kind];
    const R = 12;
    const C = 32;
    const O: THREE.Vector3[][] = [];
    const I: THREE.Vector3[][] = [];
    for (let i = 0; i <= R; i++) {
      O.push([]);
      I.push([]);
    }
    for (let j = 0; j <= C; j++) {
      const th = PI - spec.W + (2 * spec.W * j) / C;
      const side = Math.abs(Math.sin(th));
      const u = ((j / C) * spec.tufts) % 1;
      const tuft = spec.tufts ? 1 - Math.abs(2 * u - 1) : 1;
      const yTop = NECK_Y + 0.01 - 0.07 * side;
      // Lower edge: a shoulder cape cut into fringe, a short cape with a wavy edge, a long cape undulating slightly
      const yBot = spec.yBot + (spec.tufts ? -0.04 * Math.pow(tuft, 0.6) : kind === 'capelet' ? -0.03 * Math.abs(Math.sin(th * 5)) : 0.012 * Math.sin(th * 7));
      for (let i = 0; i <= R; i++) {
        const v = i / R;
        const y = yTop + (yBot - yTop) * v;
        const drape = spec.rTop + (spec.rSide - spec.rTop) * Math.sin(Math.min(1, v * 3.2) * PI * 0.5) + (spec.rBot - spec.rSide) * Math.max(0, v - 0.3) / 0.7;
        const r = Math.max(drape + 0.02 * side, torsoR(y) + 0.03);
        const zs = 0.86;
        const wv = kind === 'long' || kind === 'cloak' ? 0.018 * Math.sin(th * 5) * v * v : 0;
        const p = v3(Math.sin(th) * (r + wv), y, Math.cos(th) * (r + wv) * zs).sub(pivot);
        O[i].push(p);
        const ri = r + wv - 0.016;
        I[i].push(v3(Math.sin(th) * ri, y, Math.cos(th) * ri * zs).sub(pivot));
      }
    }
    part(g, shellGrid(O, I, false), mat, 'cape');
    // Clasp at the neckline: gold buckles on both sides and a cord in the middle
    const trim = M.toon(o.trim, { surface: 'metal' });
    // The clasp is small and darkened, so it does not compete with the face
    const claspM = M.toon(mix(o.trim, o.cape!, 0.35), { surface: 'metal' });
    if (kind === 'long' || kind === 'cloak') {
      for (const sx of [-1, 1]) {
        const th = PI - sx * spec.W;
        const a = v3(Math.sin(th) * (spec.rTop + 0.02), NECK_Y + 0.01 - 0.07 * Math.abs(Math.sin(th)), Math.cos(th) * (spec.rTop + 0.02) * 0.86);
        const f = torsoAt(sx * 0.42, NECK_Y - 0.035, 0.016);
        part(this.torso, tube([a, a.clone().lerp(f, 0.5).add(v3(0, 0.02, 0.01)), f], () => [0.013, 0.013], { segs: 10, radial: 10 }), mat, 'cape');
        part(this.torso, new THREE.CylinderGeometry(0.016, 0.016, 0.01, 14), claspM, 'trim', [f.x, f.y, f.z + 0.004], [PI / 2 - 0.3, 0, 0]);
      }
    } else if (kind === 'capelet') {
      // The short cape is fastened with a big bow at the neckline: two flat loops, a knot in the middle, and two hanging tails
      const k = torsoAt(0, NECK_Y - 0.035, 0.03);
      const bow = group(this.torso, [k.x, k.y, k.z], [-0.2, 0, 0]);
      for (const sx of [-1, 1]) {
        // Ties running from the two corners of the cape around the neckline to the front
        const th = PI - sx * spec.W;
        const a = v3(Math.sin(th) * (spec.rTop + 0.02), NECK_Y + 0.01 - 0.07 * Math.abs(Math.sin(th)), Math.cos(th) * (spec.rTop + 0.02) * 0.86);
        part(this.torso, tube([a, torsoAt(sx * 0.95, NECK_Y - 0.01, 0.022), torsoAt(sx * 0.4, NECK_Y - 0.03, 0.024), k.clone().add(v3(sx * 0.01, 0, -0.004))], () => [0.014, 0.006], { segs: 14, radial: 8 }), mat, 'cape');
        part(bow, tube([v3(0, 0, 0), v3(sx * 0.04, 0.03, 0.005), v3(sx * 0.075, 0.012, 0), v3(sx * 0.06, -0.02, 0), v3(sx * 0.01, -0.004, 0.002)], () => [0.016, 0.009], { segs: 16, radial: 10, side: v3(0, 0, 1) }), mat, 'cape');
        part(bow, tube([v3(sx * 0.005, -0.01, 0.002), v3(sx * 0.03, -0.05, 0.006), v3(sx * 0.045, -0.095, 0)], (t) => [0.014 * (1 + t * 0.3), 0.005], { segs: 10, radial: 8, side: v3(0, 0, 1) }), mat, 'cape');
      }
      part(bow, new THREE.SphereGeometry(0.02, 12, 10), mat, 'cape', [0, 0, 0.004], [0, 0, 0], [1, 0.85, 0.7]);
    } else {
      const f = torsoAt(0, NECK_Y - 0.03, 0.03);
      part(this.torso, new THREE.CylinderGeometry(0.02, 0.02, 0.012, 16), claspM, 'trim', [f.x, f.y, f.z], [PI / 2 - 0.3, 0, 0]);
    }
    (this as { cape: THREE.Group | null }).cape = g;
  }

  // ───────────── Carried items ─────────────

  /**
   * An item held in the hand, placed at the given position and direction in the standing-pose body coordinates (computes the
   * transform relative to the hand)
   */
  private placeInTorso(hand: THREE.Object3D, obj: THREE.Object3D, pos: THREE.Vector3, rot: THREE.Euler): void {
    this.restPose();
    this.root.updateMatrixWorld(true);
    const want = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(rot), new THREE.Vector3(1, 1, 1));
    const local = new THREE.Matrix4().copy(hand.matrixWorld).invert().multiply(this.torso.matrixWorld).multiply(want);
    local.decompose(obj.position, obj.quaternion, obj.scale);
  }

  private buildGear(o: Outfit, M: Mats): void {
    const wood = M.toon(0x8a5e3a);
    const woodDark = M.toon(0x6a4428);
    const trim = M.toon(o.trim, { surface: 'metal' });
    const steel = M.toon(0xd8e0ea, { surface: 'metal' });
    // Make the held item upright in the standing pose: place it in the standing pose first, then turn the item back to the world direction
    const upright = (hand: THREE.Object3D, obj: THREE.Object3D, tilt = new THREE.Euler()) => {
      this.restPose();
      this.root.updateMatrixWorld(true);
      const q = new THREE.Quaternion();
      hand.getWorldQuaternion(q);
      const rootQ = new THREE.Quaternion();
      this.root.getWorldQuaternion(rootQ);
      obj.quaternion.copy(q.invert().multiply(rootQ).multiply(new THREE.Quaternion().setFromEuler(tilt)));
    };
    switch (o.gear) {
      case 'pact': {
        // The Pactbearer's pouch: a leather bag at the right hip with a gold clasp on the flap;
        // a pact stone hangs beside the bag. The pact mark on the back of the right hand is a thin gold pattern
        const leather = M.toon(mix(o.boots, 0x000000, 0.05));
        const p = torsoAt(-1.35, 0.02, 0.03);
        const bag = group(this.torso, [p.x, p.y, p.z], [0, -1.35, 0]);
        part(bag, rbox(0.1, 0.1, 0.05, 0.016), leather, 'gear', [0, -0.03, 0.015]);
        part(bag, slab(outline([[-0.052, 0.02], [0.052, 0.02], [0.05, -0.035], [0, -0.052], [-0.05, -0.035]]), 0.008, 0.004, 4), M.toon(shade(o.boots, 0.8)), 'gear2', [0, 0.0, 0.044], [-0.08, 0, 0]);
        part(bag, new THREE.CylinderGeometry(0.012, 0.012, 0.008, 12), trim, 'trim', [0, -0.03, 0.05], [PI / 2, 0, 0]);
        // Pact stone: a pale cyan faceted gem, glowing very slightly on its own
        const stone = M.toon(0xbfeaff, { surface: 'gem', emissive: 0x8fd8ff, emissiveAmt: 0.35 });
        const sg = group(bag, [0.062, -0.05, 0.02]);
        part(sg, new THREE.TorusGeometry(0.012, 0.004, 8, 14), trim, 'trim', [0, 0.03, 0], [0, PI / 2, 0]);
        part(sg, brilliant(0.022, 0.014, 0.03, 8), stone, 'gear2', [0, 0.004, 0], [PI, 0, 0]);
        const mark = group(this.hands[0], [0.02, 0.02, -0.002], [0, PI / 2, 0]);
        const ring = new THREE.RingGeometry(0.012, 0.017, 16);
        part(mark, ring, M.toon(0xffd872, { emissive: 0xffc850, emissiveAmt: 0.5 }), null).userData.noInk = true;
        part(mark, new THREE.CircleGeometry(0.006, 8), M.toon(0xffd872, { emissive: 0xffc850, emissiveAmt: 0.5 }), null, [0, 0, 0.0005]).userData.noInk = true;
        break;
      }
      case 'notebook': {
        // Research notebook: the right hand held across the chest, hugging a hardcover notebook to the chest;
        // the cover faces forward and a pen is tucked in the spine
        this.holding[0] = true;
        this.armBase[0].set(-0.5, 0.8, 0.2);
        this.foreBase[0] = -0.9;
        const nb = group(this.hands[0]);
        const coverM = M.toon(o.cape ?? o.topDark);
        const W = 0.12, H = 0.15;
        part(nb, rbox(W - 0.01, H - 0.01, 0.026, 0.006), M.toon(0xfaf4e6), 'gear2');
        const cover = slab(outline([[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]]), 0.008, 0.003, 2);
        part(nb, cover, coverM, 'gear', [0, 0, 0.017]);
        part(nb, cover.clone(), coverM, 'gear', [0, 0, -0.017]);
        part(nb, new THREE.CylinderGeometry(0.02, 0.02, H + 0.004, 12, 1, false, PI / 2, PI), coverM, 'gear', [W / 2 - 0.004, 0, 0]);
        // A gold label on the cover and a star-shaped clasp
        part(nb, rbox(0.06, 0.03, 0.006, 0.003), trim, 'trim', [-0.004, 0.03, 0.024]);
        part(nb, new THREE.CylinderGeometry(0.012, 0.012, 0.008, 5), trim, 'trim', [-W / 2 + 0.006, -0.02, 0.022], [PI / 2, 0, 0]);
        // The pen clipped to the spine
        part(nb, tube([v3(W / 2 + 0.012, -0.04, 0.01), v3(W / 2 + 0.012, 0.11, 0.01)], roundEnds(0.008, 0.008, 0.1), { segs: 4, radial: 8 }), M.toon(o.bottom), 'gear2');
        this.placeInTorso(this.hands[0], nb, v3(-0.03, 0.29, 0.19), new THREE.Euler(-0.14, 0.18, 0.08));
        break;
      }
      case 'book': {
        this.holding[0] = true;
        this.armBase[0].set(-0.4, 0.22, -0.05);
        this.foreBase[0] = -1.4;
        const nb = group(this.hands[0], [0.02, 0, 0.0]);
        const cover = M.toon(0x8a3a3a);
        part(nb, rbox(0.05, 0.2, 0.15, 0.008), M.toon(0xf2ead2), 'gear2');
        for (const x of [-0.029, 0.029]) part(nb, rbox(0.012, 0.212, 0.162, 0.005), cover, 'gear', [x, 0, 0.004]);
        part(nb, new THREE.CylinderGeometry(0.03, 0.03, 0.212, 14, 1, false, PI, PI), cover, 'gear', [0, 0, -0.078]);
        for (const y of [-0.09, 0.09]) part(nb, rbox(0.072, 0.03, 0.03, 0.006), trim, 'trim', [0, y, 0.07]);
        upright(this.hands[0], nb, new THREE.Euler(0.1, -0.3, 0));
        nb.position.set(0.035, -0.01, 0.04);
        break;
      }
      case 'staff': {
        // A walking staff: the head is a section curved back, with cloth wrapped where it is held
        this.holding[0] = true;
        this.armBase[0].set(-0.2, 0, -0.16);
        this.foreBase[0] = -0.55;
        const st = group(this.hands[0], [0, 0, 0]);
        const pts = [v3(0, -0.62, 0), v3(0.008, -0.3, 0.004), v3(-0.006, 0.05, -0.004), v3(0.004, 0.3, 0.002), v3(0.03, 0.42, 0), v3(0.07, 0.43, 0), v3(0.085, 0.38, 0)];
        part(st, tube(pts, (t) => {
          const r = 0.016 + 0.006 * Math.sin(t * 17) * 0.4 + (t > 0.72 ? 0.006 : 0);
          const e = Math.sqrt(Math.min(1, t * 30, (1 - t) * 18));
          return [r * e, r * e];
        }, { segs: 40, radial: 10 }), wood, 'gear');
        part(st, revShell([[0.022, 0.07], [0.023, -0.05]], 0.008, { seg: 14 }), M.toon(o.topDark), 'gear2');
        upright(this.hands[0], st);
        break;
      }
      case 'spear': {
        const onBack = o.hat === 'band';
        const sp = onBack ? group(this.torso, [0, 0.26, -0.2], [0, 0, 0.5]) : group(this.hands[0], [0, 0, 0]);
        if (!onBack) {
          this.holding[0] = true;
          this.armBase[0].set(-0.22, 0, -0.2);
          this.foreBase[0] = -0.75;
        }
        const len = onBack ? 1.15 : 1.5;
        const y0 = onBack ? -len / 2 : -0.6;
        part(sp, tube([v3(0, y0, 0), v3(0, y0 + len, 0)], () => [0.014, 0.014], { segs: 2, radial: 10 }), woodDark, 'gear');
        part(sp, revSolid([[0.001, y0 - 0.02], [0.018, y0 - 0.01], [0.018, y0 + 0.02], [0.001, y0 + 0.02]], { seg: 12 }), steel, 'metal');
        // Spearhead: a leaf-shaped beveled plate with a center ridge, with a socket below
        const tipY = y0 + len;
        part(sp, revSolid([[0.018, tipY - 0.05], [0.02, tipY], [0.012, tipY + 0.02], [0.001, tipY + 0.02]], { seg: 12 }), steel, 'metal');
        const blade = slab(outline([[0, 0], [0.03, 0.05], [0.026, 0.1], [0, 0.17], [-0.026, 0.1], [-0.03, 0.05]]), 0.008, 0.005, 6);
        part(sp, blade, steel, 'metal', [0, tipY + 0.012, 0]);
        part(sp, blade.clone(), steel, 'metal', [0, tipY + 0.012, 0], [0, PI / 2, 0], [0.55, 1, 1]);
        // Spear tassel
        const tas = M.toon(onBack ? o.trim : 0xb8403a);
        part(sp, tube([v3(0, tipY - 0.03, 0), v3(0.02, tipY - 0.08, 0.01), v3(0.03, tipY - 0.15, 0.0)], (t) => {
          const r = 0.03 * Math.sin(Math.min(1, t * 2 + 0.2) * PI * 0.5) * (1 - t * 0.7);
          return [r, r];
        }, { segs: 10, radial: 12 }), tas, 'gear2');
        if (!onBack) upright(this.hands[0], sp);
        else {
          // Strap: running from the right shoulder diagonally to the left hip
          const a = torsoAt(-0.55, 0.43, 0.012);
          const b = torsoAt(-2.2, 0.28, 0.015);
          const cpt = torsoAt(2.5, 0.12, 0.015);
          const e = torsoAt(1.2, 0.06, 0.012);
          part(this.torso, tube([a, torsoAt(-0.1, 0.3, 0.012), torsoAt(0.6, 0.14, 0.012), e], () => [0.018, 0.006], { segs: 16, radial: 8 }), M.toon(o.topDark), 'topDark');
          part(this.torso, tube([a, b, torsoAt(PI, 0.2, 0.016), cpt, e], () => [0.018, 0.006], { segs: 18, radial: 8 }), M.toon(o.topDark), 'topDark');
        }
        break;
      }
      case 'sword': {
        // Sword at the side: a scabbard at the left hip with a gold mouth and tip, the guard and pommel showing in front of the waist
        const hip = torsoAt(1.25, 0.06, 0.03);
        const sw = group(this.torso, [hip.x, hip.y, hip.z], [0.95, 0.15, 0.2]);
        const sheath = M.toon(0x3a2e3e);
        part(sw, tube([v3(0, 0.02, 0), v3(0, -0.46, 0)], (t) => [0.03 * (1 - t * 0.25), 0.014], { segs: 6, radial: 12, side: v3(0, 0, 1) }), sheath, 'gear');
        part(sw, revShell([[0.034, 0.03], [0.034, -0.02]], 0.01, { seg: 14, zs: 0.5 }), trim, 'trim');
        part(sw, new THREE.SphereGeometry(0.026, 12, 10), trim, 'trim', [0, -0.46, 0], [0, 0, 0], [1, 1.3, 0.55]);
        part(sw, rbox(0.13, 0.022, 0.03, 0.009), trim, 'trim', [0, 0.05, 0]);
        part(sw, tube([v3(0, 0.06, 0), v3(0, 0.15, 0)], () => [0.015, 0.015], { segs: 3, radial: 10 }), M.toon(0x4a3040), 'gear2');
        part(sw, new THREE.SphereGeometry(0.024, 12, 10), trim, 'trim', [0, 0.165, 0]);
        break;
      }
      case 'lantern': {
        // The lamplighter's lantern: held in the left hand, the frame dark metal and the wick a purple light
        this.holding[1] = true;
        this.armBase[1].set(-0.15, 0, 0.08);
        this.foreBase[1] = -0.5;
        const lt = group(this.hands[1], [0, 0, 0]);
        const frame = M.toon(0x2a2238, { surface: 'metal' });
        part(lt, new THREE.TorusGeometry(0.035, 0.006, 8, 16, PI), frame, 'metal', [0, -0.01, 0], [0, PI / 2, 0]);
        const top = -0.045;
        part(lt, revSolid([[0.001, top + 0.03], [0.02, top + 0.025], [0.05, top], [0.055, top - 0.012], [0.001, top - 0.012]], { seg: 16 }), frame, 'metal');
        part(lt, revSolid([[0.001, top - 0.16], [0.055, top - 0.16], [0.058, top - 0.14], [0.05, top - 0.13], [0.001, top - 0.13]], { seg: 16 }), frame, 'metal');
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * 2 * PI + PI / 4;
          part(lt, tube([v3(Math.sin(a) * 0.048, top - 0.012, Math.cos(a) * 0.048), v3(Math.sin(a) * 0.05, top - 0.13, Math.cos(a) * 0.05)], () => [0.006, 0.006], { segs: 2, radial: 6 }), frame, 'metal');
        }
        const glow = M.basic(o.trim, 2.2);
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), glow);
        core.scale.set(1, 1.3, 1);
        core.position.set(0, top - 0.072, 0);
        core.userData.noInk = true;
        lt.add(core);
        const glass = M.toon(mix(o.trim, 0xffffff, 0.5), { emissive: o.trim, emissiveAmt: 0.6 });
        part(lt, revSolid([[0.001, top - 0.125], [0.044, top - 0.12], [0.046, top - 0.07], [0.04, top - 0.02], [0.001, top - 0.015]], { seg: 16 }), glass, null).userData.noInk = true;
        upright(this.hands[1], lt);
        break;
      }
    }
  }

  private buildExtras(o: Outfit, head: THREE.Group, M: Mats): void {
    const ex = o.extras ?? [];
    const T = this.torso;
    for (const e of ex) {
      switch (e) {
        case 'strap': {
          // Crossbody strap: the pouch from the left shoulder diagonally to the right hip
          const leather = M.toon(mix(o.boots, 0x000000, 0.1));
          const pts = [torsoAt(0.62, 0.43, 0.012), torsoAt(0.2, 0.33, 0.014), torsoAt(-0.45, 0.2, 0.014), torsoAt(-1.2, 0.06, 0.03)];
          part(T, tube(pts, () => [0.017, 0.006], { segs: 16, radial: 8 }), leather, 'cloth');
          const back = [torsoAt(0.62, 0.43, 0.012), torsoAt(1.5, 0.38, 0.016), torsoAt(2.4, 0.24, 0.016), torsoAt(PI + 0.9, 0.08, 0.02), torsoAt(-1.4, 0.04, 0.03)];
          part(T, tube(back, () => [0.017, 0.006], { segs: 18, radial: 8 }), leather, 'cloth');
          break;
        }
        case 'neckerchief': {
          const nk = M.toon(o.trim);
          const k = torsoAt(0, NECK_Y - 0.02, 0.02);
          part(T, revShell([[0.1, NECK_Y + 0.03], [0.108, NECK_Y - 0.01]], 0.02, { seg: 30, zs: 0.9 }), nk, 'trim');
          part(T, new THREE.SphereGeometry(0.026, 12, 10), nk, 'trim', [k.x, k.y, k.z]);
          part(T, slab(outline([[-0.06, 0], [0.06, 0], [0, -0.09]]), 0.01, 0.004, 4), nk, 'trim', [k.x, k.y - 0.005, k.z - 0.004], [-0.35, 0, 0]);
          break;
        }
        case 'scarf': {
          const sc = M.toon(o.scarf ?? 0xe8483a);
          part(T, revShell([[0.1, NECK_Y + 0.05], [0.13, NECK_Y + 0.01], [0.13, NECK_Y - 0.03]], 0.035, { seg: 30, zs: 0.9, wave: (th) => 0.03 * Math.sin(th * 4) }), sc, 'cloth');
          const a = torsoAt(-0.5, NECK_Y - 0.01, 0.045);
          part(T, tube([a, a.clone().add(v3(-0.02, -0.08, 0.02)), a.clone().add(v3(-0.03, -0.17, 0.0))], (t) => [0.032 * (1 - t * 0.2), 0.01], { segs: 10, radial: 10, side: v3(1, 0, 0.3) }), sc, 'cloth');
          const b = torsoAt(PI - 0.3, NECK_Y - 0.01, 0.045);
          part(T, tube([b, b.clone().add(v3(0.03, -0.06, -0.06)), b.clone().add(v3(0.06, -0.12, -0.12))], (t) => [0.03 * (1 - t * 0.3), 0.01], { segs: 10, radial: 10 }), sc, 'cloth');
          break;
        }
        case 'beads': {
          const bd = M.toon(o.trim, { surface: 'gem' });
          const g = new THREE.SphereGeometry(0.016, 10, 8);
          for (let k = 0; k < 11; k++) {
            const th = -1.2 + (k / 10) * 2.4;
            const y = NECK_Y - 0.06 - 0.06 * Math.cos((th / 1.2) * PI * 0.5);
            const p = torsoAt(th, y, 0.018);
            part(T, g.clone(), bd, 'trim', [p.x, p.y, p.z]);
          }
          break;
        }
        case 'glasses': {
          // Round-frame glasses: gold frames, the bridge resting on the nose, thin temples hooking over the ears
          const fr = M.toon(o.trim, { surface: 'metal' });
          const hs = this.hs;
          const at = (x: number, y: number, lift: number) => {
            const [th, lat] = hs.facing(x, y);
            return hs.at(PI / 2 - lat, th, lift);
          };
          for (const sx of [-1, 1]) {
            const [th, lat] = hs.facing(sx * this.fc.eyeX, this.fc.eyeY);
            const p = hs.at(PI / 2 - lat, th, 0.028);
            const rim = part(head, new THREE.TorusGeometry(0.05, 0.006, 8, 28), fr, 'trim', [p.x, p.y, p.z]);
            rim.quaternion.setFromUnitVectors(v3(0, 0, 1), hs.normal(PI / 2 - lat, th));
            const ear = hs.at(PI / 2 - lat + 0.08, sx * 1.5, 0.018);
            part(head, tube([at(sx * (this.fc.eyeX + 0.16), this.fc.eyeY + 0.02, 0.028), at(sx * 0.82, this.fc.eyeY + 0.04, 0.03), ear], () => [0.005, 0.005], { segs: 10, radial: 6 }), fr, 'trim');
          }
          part(head, tube([at(-this.fc.eyeX + 0.16, this.fc.eyeY + 0.03, 0.03), at(0, this.fc.eyeY + 0.07, 0.045), at(this.fc.eyeX - 0.16, this.fc.eyeY + 0.03, 0.03)], () => [0.005, 0.005], { segs: 8, radial: 6 }), fr, 'trim');
          break;
        }
        case 'circlet': {
          // Elda's gold circlet: a thin gold ring with a pale gold gem at the front of the forehead
          const hs = this.hs;
          const gold = M.toon(o.trim, { surface: 'metal' });
          // Hugs the hair: follows the original hair's outer surface; the bangs at the front are thin and the hair at the
          // sides and back is thick, so the circlet's height above the scalp varies accordingly
          const hairOff = this.kk.hair ? kaykitHairOff(this.kk, hs) : () => 0.05;
          const Lc = angleCurve([[0, 1.2], [1.3, 1.1], [PI, 1.0]]);
          const lift = (th: number) => hairOff(Lc(th) * 0.97, th) + 0.01;
          part(head, capShell(hs, { L: Lc, from: 0.93, off: (_s, th) => lift(th), inner: (th) => lift(th) - 0.018, cols: 80, rows: 3 }), gold, 'trim');
          const p = hs.at(1.14, 0, lift(0) + 0.004);
          const gem = part(head, brilliant(0.024, 0.012, 0.018, 8), M.toon(0xfff0c8, { surface: 'gem', emissive: 0xffe0a0, emissiveAmt: 0.25 }), 'gear2', [p.x, p.y, p.z]);
          gem.quaternion.setFromUnitVectors(v3(0, 1, 0), hs.normal(1.14, 0));
          break;
        }
        case 'mask': {
          // Mask: a pale shell covering the whole face, with two slanted eye slits and one crack; not registered into mats,
          // so it stays white in silhouette
          const hs = this.hs;
          const pale = sceneMaterial(0xe8e2da, { rim: 0.2 });
          this.extraMats.push(pale);
          const O: THREE.Vector3[][] = [];
          const I: THREE.Vector3[][] = [];
          const R = 16, C = 30;
          for (let i = 0; i <= R; i++) {
            O.push([]);
            I.push([]);
          }
          for (let j = 0; j <= C; j++) {
            const th = -1.15 + (j / C) * 2.3;
            const k = 1 - (th / 1.15) ** 2;
            const top = 0.2 + 0.4 * Math.sqrt(k);
            const bot = -0.55 - 0.45 * Math.sqrt(k);
            for (let i = 0; i <= R; i++) {
              const lat = top + (bot - top) * (i / R);
              const phi = PI / 2 - lat;
              O[i].push(hs.at(phi, th, 0.042));
              I[i].push(hs.at(phi, th, 0.018));
            }
          }
          part(head, shellGrid(O, I, false), pale, 'mask');
          const ink = sceneMaterial(0x12081a, { rim: 0 });
          ink.polygonOffset = true;
          ink.polygonOffsetFactor = -2;
          ink.polygonOffsetUnits = -4;
          this.extraMats.push(ink);
          for (const sx of [-1, 1]) part(head, hs.decal(stroke((t) => [sx * (0.18 + t * 0.34), -0.02 + (t - 0.5) * 0.12 * 1], (t) => 0.07 * Math.sin(t * PI) + 0.004, 16), 0.0435), ink, null);
          part(head, hs.decal(stroke((t) => [0.12 + t * 0.14, 0.05 - t * 0.55 + 0.04 * Math.sin(t * 9)], () => 0.014, 16), 0.0435), ink, null);
          break;
        }
      }
    }
  }

  /** Back to the standing pose: hands, elbows, legs, knees, head, body (also called at the start of each prologue segment) */
  restPose(): void {
    this.arms.forEach((a, i) => a.quaternion.setFromEuler(a.rotation.copy(this.armBase[i])));
    this.fores.forEach((f, i) => f.rotation.set(this.foreBase[i], 0, 0));
    for (const l of this.legs) l.rotation.set(0, 0, 0);
    for (const s of this.shins) s.rotation.set(0, 0, 0);
    this.c.head.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.hips.rotation.set(0, 0, 0);
    this.hips.position.set(0, HIP, 0);
    if (this.cape) this.cape.rotation.set(0.05, 0, 0);
    for (const t of this.tails) t.rotation.set(0, 0, 0);
  }

  /** Per-frame update: stride, arms, body, head, cape and hair tips; Creature handles the blink and the white flash */
  update(dt: number): void {
    const sp = this.speed;
    const move = Math.min(1, sp / 6);
    const walkK = Math.min(1, sp * 0.8);
    this.t += dt;
    this.phase += dt * (3 + sp * 1.25);
    const ph = this.phase;
    const t = this.t;
    const air = this.air;
    const amp = air ? 0 : 0.3 + move * 0.5;
    const idle = 1 - Math.min(1, sp * 1.5);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const side = i === 0 ? -1 : 1;
      const swing = Math.sin(ph) * amp * s * walkK;
      this.legs[i].rotation.set(air ? (i === 0 ? -0.9 : 0.35) : swing, 0, 0);
      this.shins[i].rotation.x = air ? (i === 0 ? 1.1 : 0.35) : Math.max(0, -Math.cos(ph) * s) * (0.45 + move * 0.9) * walkK;
      const base = this.armBase[i];
      const hold = this.holding[i] ? 0.25 : 1;
      const waveK = i === 1 ? this.wave : 0;
      const arm = this.arms[i];
      arm.rotation.x = base.x * (1 - waveK) + (air ? -1.6 : -swing * 0.9 * hold) + idle * Math.sin(t * 1.3 + i * 2) * 0.03 - waveK * 2.55;
      arm.rotation.y = base.y * (1 - waveK);
      arm.rotation.z = base.z * (1 - waveK) + side * (air ? 0.5 : 0) + side * waveK * 0.35 + side * move * 0.08;
      this.fores[i].rotation.x = this.foreBase[i] * (1 - waveK) - (air ? 0.6 : move * 0.75 * walkK * hold) - waveK * 0.45;
      this.fores[i].rotation.z = 0;
    }
    if (this.wave > 0) {
      this.arms[1].rotation.z += Math.sin(t * 13) * 0.2 * this.wave;
      this.fores[1].rotation.z = Math.sin(t * 13 + 0.6) * 0.35 * this.wave;
    }
    // Body: bobs up and down, leans forward and twists at the waist when walking; shifts weight side to side when standing
    const bob = air ? 0 : Math.abs(Math.sin(ph)) * 0.04 * move;
    this.hips.position.set(Math.sin(t * 0.8) * 0.006 * idle, HIP + bob - (1 - Math.abs(Math.cos(ph))) * 0.0 * move, 0);
    this.hips.rotation.set(0, -Math.sin(ph) * 0.07 * move, Math.sin(t * 0.8) * 0.02 * idle);
    this.torso.rotation.set(move * 0.16 + (air ? 0.1 : 0), Math.sin(ph) * 0.12 * move, -Math.sin(t * 0.8) * 0.015 * idle);
    this.sway += (move - this.sway) * Math.min(1, dt * 4);
    // A positive x rotation makes the hem flutter toward -z (behind)
    if (this.cape) {
      this.cape.rotation.x = 0.05 + this.sway * 0.75 + Math.sin(ph * 2) * 0.05 * move + (air ? 0.4 : 0) + idle * Math.sin(t * 1.1) * 0.015;
      this.cape.rotation.z = Math.sin(ph) * 0.05 * move;
    }
    for (const [k, tl] of this.tails.entries()) {
      tl.rotation.x = -this.sway * 0.45 + Math.sin(ph * 2 + k) * 0.08 * move + idle * Math.sin(t * 1.4 + k) * 0.04;
      tl.rotation.z = (k === 0 ? 1 : -1) * (Math.sin(ph) * 0.1 * move + idle * Math.sin(t * 0.9 + k) * 0.03);
    }
    // Creature: blink, breathing, white flash (it moves the head's x and z, which are overwritten again below)
    this.c.moving = 0;
    this.c.update(dt);
    this.c.body.position.y = 0;
    // Head: when standing, now and then turns to look aside; looks straight ahead when spoken to
    this.lookIn -= dt;
    if (this.lookIn <= 0) {
      this.lookIn = 2 + Math.random() * 4;
      this.lookGoal = Math.random() < 0.45 ? 0 : (Math.random() - 0.5) * 0.9;
    }
    const goal = this.wave > 0.05 ? 0 : this.lookGoal * idle;
    this.look += (goal - this.look) * Math.min(1, dt * 3);
    this.c.head.rotation.set(-move * 0.12 + Math.sin(t * 1.1) * 0.02 * idle - bob * 1.2, this.look - Math.sin(ph) * 0.1 * move, Math.sin(t * 0.7) * 0.035 * idle);
  }

  dispose(): void {
    this.c.dispose();
    for (const m of this.extraMats) m.dispose();
  }
}

const lerp = THREE.MathUtils.lerp;

/** Round shadow under the feet */
export function blobShadow(tex: THREE.Texture, size: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55 }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

export type { V3 };
