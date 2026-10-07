// Drag-and-drop rules for the battle party (shared by the Bag and the pre-battle party select):
// swap positions within the party, swap a spirit below with one in the party, drop into an empty slot, drag to the empty area below to remove from the party.
// Drop targets: slot:<position> (battle party), tile:<uid> (a spirit below), store (the area below).

import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.ts';
import { store } from './store.ts';
import { parseDrop, useDragDrop } from './dragDrop.ts';

/** On touch devices a spirit is picked up with a long press, and the hint text follows */
export const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function canDrop(party: string[], uid: string, target: string): boolean {
  const from = party.indexOf(uid);
  const { kind, arg } = parseDrop(target);
  if (kind === 'slot') {
    const i = Number(arg);
    return from >= 0 ? !!party[i] && i !== from : true;
  }
  if (kind === 'tile') return from >= 0 && arg !== uid;
  return kind === 'store' && from >= 0;
}

/** The new party after a drop, and the other spirit that was swapped out (or in) */
function applyDrop(party: string[], uid: string, target: string): { party: string[]; other?: string } {
  const p = [...party];
  const from = p.indexOf(uid);
  const { kind, arg } = parseDrop(target);
  if (kind === 'slot') {
    const i = Number(arg);
    const other = p[i];
    if (!other) p.push(uid);
    else if (from >= 0) [p[from], p[i]] = [other, uid];
    else p[i] = uid;
    return { party: p, other };
  }
  if (kind === 'tile') {
    p[from] = arg;
    return { party: p, other: arg };
  }
  p.splice(from, 1);
  return { party: p };
}

type Opts = {
  party: string[];
  /** The minimum number of spirits that must remain after removing one from the party */
  minSize?: number;
  commit: (next: string[], uid: string) => void;
  /** Released without moving after a touch long press: treated as a tap */
  onTap: (uid: string) => void;
  onStart?: () => void;
};

export function usePartyDrag(o: Opts) {
  const [landed, setLanded] = useState<string[]>([]);
  useEffect(() => {
    if (!landed.length) return;
    const t = window.setTimeout(() => setLanded([]), 450);
    return () => window.clearTimeout(t);
  }, [landed]);
  const dnd = useDragDrop<string>({
    canDrop: (uid, t) => canDrop(o.party, uid, t),
    onDrop: (uid, t) => {
      const min = o.minSize ?? 0;
      if (parseDrop(t).kind === 'store' && o.party.length <= min) {
        sfx.error();
        store.showToast(`出戰隊伍至少需要 ${min} 隻精靈`);
        return;
      }
      const r = applyDrop(o.party, uid, t);
      sfx.confirm();
      o.commit(r.party, uid);
      setLanded(r.other ? [uid, r.other] : [uid]);
    },
    onStart: () => {
      sfx.click();
      o.onStart?.();
    },
    onTap: o.onTap,
    ghostOf: '.thumb',
  });
  const d = dnd.drag;
  /** Props and class for a draggable spirit (pass its uid) or a drop target: the source goes translucent, valid drop spots are hinted, the target under the pointer is highlighted */
  const target = (key: string, uid?: string) => {
    const ok = !!d && canDrop(o.party, d.src, key);
    const over = ok && d?.over === key;
    const cls = [uid && d?.src === uid && 'drag-src', ok && 'drop-ok', over && 'drop-over', uid && landed.includes(uid) && 'landed'].filter(Boolean).join(' ');
    return { cls, over, attrs: { 'data-drop': key, ...(uid ? dnd.bind(uid) : {}) } };
  };
  return {
    dragging: d?.src,
    fromParty: !!d && o.party.includes(d.src),
    over: d?.over ?? null,
    target,
    rootRef: dnd.rootRef,
  };
}
