// Load notice after a kit revision: when sanitizeLoadout has corrected the skill slots in a save, show a one-time notification that does not block input.
// Loading a save (normalizeSave in game/save.ts) corrects silently and reports nothing, so at module load time (before any screen writes back to the save)
// this reads the raw save once and dry-runs sanitizeLoadout on a copy to see whether anything changes.

import { useEffect, useState } from 'react';
import { sanitizeLoadout } from '../game/loadout.ts';
import type { SpiritInstance } from '../engine/types.ts';
import { sfx } from '../audio/sfx.ts';
import { Icon } from './icons.tsx';

/** Same as the save key in game/save.ts */
const SAVE_KEY = 'eldor-save-v1';
/** The raw skill slots already notified about (the same old save is only notified once) */
const SEEN_KEY = 'eldor-kit-notice';
const TEXT = '技能組已更新，已為你的精靈重新配招';

type RawSave = { spirits?: SpiritInstance[] } | null | undefined;

/** Whether loading this (not yet corrected) save would change its skill slots */
export function loadoutsNeedRepair(d: RawSave): boolean {
  if (!d || !Array.isArray(d.spirits)) return false;
  return d.spirits.some((s) => !!s && sanitizeLoadout({ ...s, loadout: Array.isArray(s.loadout) ? [...s.loadout] : [] }));
}

function signature(d: RawSave): string {
  const raw = (d?.spirits ?? []).map((s) => `${s?.uid}:${Array.isArray(s?.loadout) ? s.loadout.join(',') : ''}`).join('|');
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  return `${raw.length}:${h}`;
}

/** The same old save is notified only once: record its signature */
function firstTime(d: RawSave): boolean {
  try {
    const sig = signature(d);
    if (localStorage.getItem(SEEN_KEY) === sig) return false;
    localStorage.setItem(SEEN_KEY, sig);
  } catch {
    /* Private mode: notify anyway */
  }
  return true;
}

let pending = false;
let listener: (() => void) | null = null;

// Check the local save at module load (the test save ?devsave is not notified)
try {
  if (typeof location !== 'undefined' && !new URLSearchParams(location.search).has('devsave')) {
    const raw = localStorage.getItem(SAVE_KEY);
    const d = raw ? (JSON.parse(raw) as RawSave) : null;
    if (loadoutsNeedRepair(d) && firstTime(d)) pending = true;
  }
} catch {
  /* Save unreadable: no notice */
}

/** Call before loading another save (from the cloud): shows the notice when this save's skill slots need correcting */
export function noticeIfRepaired(d: RawSave): void {
  if (!loadoutsNeedRepair(d) || !firstTime(d)) return;
  pending = true;
  listener?.();
}

/** Mounted at the top level: a one-time notification that does not block input */
export function KitNotice() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const show = () => {
      if (!pending) return;
      pending = false;
      // Let the title screen or the cloud-load notice appear first
      window.setTimeout(() => setOn(true), 900);
    };
    listener = show;
    show();
    return () => {
      listener = null;
    };
  }, []);
  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => setOn(false), 9000);
    return () => window.clearTimeout(t);
  }, [on]);
  if (!on) return null;
  return (
    <div className="kit-notice panel" role="status">
      <span className="kn-ico"><Icon name="swap" size={18} /></span>
      <span className="kn-text">
        <b>{TEXT}</b>
        <small>每隻精靈現在都有自己的技能表；可在背包的「技能」分頁重新配置。</small>
      </span>
      <button className="kn-close" onClick={() => { sfx.click(); setOn(false); }} aria-label="關閉">×</button>
    </div>
  );
}
