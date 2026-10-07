// Viewing the map characters on the ?lab test bench: each look is wrapped into a lab-version builder (char_<look>),
// registered in labCreature.ts's LAB_BUILDERS.
// The model is the game's own Avatar, so the look and motion on the bench match the game (lighting and tone mapping follow the bench).
// char_player_walk makes the hero walk in place and char_player_run makes the hero run in place, to check the stride; char_mila_wave checks the wave.
// With &face in the URL the camera frames only the head, to check the face and hair; &hide=skin,hair hides those parts;
// &nomerge shows how it looks before the parts are merged into a vertex-color mesh.

import * as THREE from 'three';
import type { NpcLook } from '../../game/campaign.ts';
import type { LabBuilder, LabModel } from '../lab/shapes.ts';
import { Avatar, npcOutfit, playerOutfit, PROLOGUE_LOOKS, type Outfit } from './avatar.ts';
import { ROLE, ROLE_BASE, type Role } from './avatarKit.ts';

function charModel(o: Outfit, pose: { speed?: number; wave?: boolean } = {}): LabModel {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  // &hide=skin,hair: hide some parts to inspect what they cover (we need to see each outline group,
  // so vertex colors are not baked); &nomerge shows the pre-merge look
  const hide = (q.get('hide') ?? '').split(',').filter((r): r is Role => r in ROLE);
  const a = new Avatar(o, { merge: !hide.length && !q.has('nomerge') });
  // Framing uses the bounding box of the standing pose (it is a standing pose right after build):
  // unaffected by the idle sway's randomness, and the same whether or not the parts are merged
  a.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.root);
  const h = box.max.y;
  const fa = a.faceAnchors;
  const faceZoom = q.has('face');
  // Face close-up: frame on the skull center (the head's bounding box would count the long hair and the hair tips)
  const hc = a.c.head.getWorldPosition(new THREE.Vector3());
  const hk = a.c.head.getWorldScale(new THREE.Vector3()).y;
  a.speed = pose.speed ?? 0;
  a.update(0);
  if (hide.length) {
    const keys = new Set(hide.map((r) => ROLE_BASE + ROLE[r]));
    a.root.traverse((m) => {
      if (keys.has(m.userData.inkGroup)) m.visible = false;
    });
  }
  let last = 0;
  return {
    root: a.root,
    update: (t, dt) => {
      if (pose.wave) a.wave = 0.5 + 0.5 * Math.max(0, Math.sin(t * 0.9));
      if (dt > 0) {
        a.update(dt);
        return;
      }
      // Frozen time (&t=): step from 0 to t one frame at a time, so a screenshot can catch a particular moment of the walk
      while (last < t - 1e-6) {
        const step = Math.min(1 / 60, t - last);
        a.update(step);
        last += step;
      }
    },
    center: faceZoom ? new THREE.Vector3(0, hc.y, 0) : new THREE.Vector3(0, h * 0.52, 0),
    radius: faceZoom ? 0.44 * hk : h * 0.56,
    rig: { head: a.c.head, eyes: fa.eyes, anchors: { mouth: fa.mouth, face: fa.face } },
  };
}

const LOOKS: NpcLook[] = ['mila', 'villager', 'elder', 'guard', 'kid', 'scholar', 'knight', 'nomad', 'shade'];

/** A character's lab-version builder (ignores evolution stages) */
export const CHAR_LAB_BUILDERS: Record<string, LabBuilder> = {
  char_player: () => charModel(playerOutfit('sword')),
  char_player_walk: () => charModel(playerOutfit('sword'), { speed: 2.6 }),
  char_player_run: () => charModel(playerOutfit('sword'), { speed: 6.5 }),
  ...Object.fromEntries(LOOKS.map((l) => [`char_${l}`, () => charModel(npcOutfit(l))])),
  char_mila_wave: () => charModel(npcOutfit('mila'), { wave: true }),
  char_elda: () => charModel(PROLOGUE_LOOKS.elda),
  char_child: () => charModel(PROLOGUE_LOOKS.child),
  char_masked: () => charModel({ ...PROLOGUE_LOOKS.masked, scale: 1.3 }),
};

/** The name in the bench's list */
export const CHAR_LAB_NAMES: Record<string, string> = {
  char_player: '主角（締約者）',
  char_player_walk: '主角：走路',
  char_player_run: '主角：跑步',
  char_mila: '米菈',
  char_mila_wave: '米菈：揮手',
  char_villager: '鎮民',
  char_elder: '長老',
  char_guard: '守衛',
  char_kid: '小孩',
  char_scholar: '學者',
  char_knight: '騎士',
  char_nomad: '牧民',
  char_shade: '守燈人',
  char_elda: '艾爾達（序章）',
  char_child: '孩子（序章）',
  char_masked: '蒙面人（序章）',
};
