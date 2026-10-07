// Shared screen components: 3D scene mount, resource bar, back button, spirit avatar and card, dialog box.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Stage } from '../render/stage.ts';
import { cachedThumb, requestThumb } from '../render/thumbs.ts';
import { getSpirit } from '../data.ts';
import type { SpiritInstance } from '../engine/types.ts';
import { expToNext } from '../../sim/formulas.ts';
import { sfx } from '../audio/sfx.ts';
import { ElementChip, RarityTag } from './common.tsx';
import { store, useStore } from './store.ts';
import { HelpButton } from './Help.tsx';
import { ItemAmount } from './items.tsx';
import { MenuIcon } from './menuIcons.tsx';

let stageRef: Stage | null = null;
export function setStage(s: Stage): void {
  stageRef = s;
}
export function getStage(): Stage {
  return stageRef ?? (window as unknown as { __stage: Stage }).__stage;
}

/** Apply the quality setting: auto = start at high quality and step down automatically when it stutters */
export function applyQuality(stage: Stage, q: 'auto' | 'high' | 'low'): void {
  stage.autoQuality = q === 'auto';
  stage.setQuality(q === 'low' ? 'low' : 'high');
}

/** Mounts a 3D scene and releases it automatically when the component unmounts */
export function useScene<T extends { dispose(): void }>(factory: (s: Stage) => T, deps: unknown[]): T | null {
  const [scene, setScene] = useState<T | null>(null);
  useEffect(() => {
    const sc = factory(getStage());
    setScene(sc);
    return () => sc.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return scene;
}

export function TopBar({ title, back, settings }: { title?: string; back?: () => void; settings?: boolean }) {
  const { save } = useStore();
  const inv = save.inv;
  return (
    <div className="topbar">
      {back && (
        <button className="back" onClick={() => { sfx.click(); back(); }}>
          ‹ 返回
        </button>
      )}
      {title && <div className="tb-title">{title}</div>}
      <div className="res">
        <ItemAmount id="gold" amount={inv.gold} />
        <ItemAmount id="crystals" amount={inv.crystals} />
        <ItemAmount id="tickets" amount={inv.tickets} />
        <HelpButton />
        {settings && (
          <button className="gear-btn" title="設定" aria-label="設定" onClick={() => { sfx.click(); store.go({ name: 'settings' }); }}>
            <MenuIcon name="settings" size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

export function Thumb({ speciesId, stage, silhouette, size = 96 }: { speciesId: string; stage: 1 | 2 | 3; silhouette?: boolean; size?: number }) {
  const [url, setUrl] = useState<string | undefined>(() => cachedThumb(speciesId, stage, silhouette));
  useEffect(() => {
    let alive = true;
    const c = cachedThumb(speciesId, stage, silhouette);
    if (c) setUrl(c);
    else void requestThumb(speciesId, stage, silhouette).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [speciesId, stage, silhouette]);
  return <div className={`thumb ${silhouette ? 'sil' : ''}`} style={{ width: size, height: size }}>{url ? <img src={url} alt="" draggable={false} /> : <div className="thumb-load" />}</div>;
}

export function SpiritCard({ s, onClick, selected, badge, dim }: { s: SpiritInstance; onClick?: () => void; selected?: boolean; badge?: ReactNode; dim?: boolean }) {
  const sp = getSpirit(s.speciesId);
  return (
    <button className={`scard r-${sp.rarity}-b ${selected ? 'sel' : ''} ${dim ? 'dim' : ''}`} onClick={() => { sfx.click(); onClick?.(); }}>
      <Thumb speciesId={s.speciesId} stage={s.stage} size={84} />
      <div className="scard-info">
        <div className="scard-name">{sp.name}</div>
        <div className="scard-meta">
          <RarityTag r={sp.rarity} />
          <span className="lv">Lv {s.level}</span>
          {sp.elements.map((e) => (
            <ElementChip key={e} el={e} />
          ))}
        </div>
        {s.resonance > 0 && <ResonancePips n={s.resonance} />}
      </div>
      {badge}
    </button>
  );
}

/** Resonance level: five diamond gems that turn gold when full (shared by the Bag, spirit cards, the summon UP card and the menu) */
export function ResonancePips({ n }: { n: number }) {
  return (
    <span className={`reso-pips ${n >= 5 ? 'max' : ''}`} title={`共鳴 R${n}`}>
      {[0, 1, 2, 3, 4].map((k) => <i key={k} className={k < n ? 'on' : ''} />)}
    </span>
  );
}

export function ExpBar({ s }: { s: SpiritInstance }) {
  const need = expToNext(s.level);
  const pct = s.level >= 60 ? 1 : Math.min(1, s.exp / need);
  return (
    <div className="expbar">
      <div className="expfill" style={{ width: `${pct * 100}%` }} />
      <span>{s.level >= 60 ? 'MAX' : `${s.exp} / ${need}`}</span>
    </div>
  );
}

export function Dialogue({ lines, onDone }: { lines: { who: string; text: string }[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const line = lines[i];
  const timer = useRef<number | null>(null);
  useEffect(() => {
    setShown(0);
    timer.current = window.setInterval(() => setShown((n) => n + 1), 28);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [i]);
  const full = shown >= [...(line?.text ?? '')].length;
  const advance = () => {
    sfx.click();
    if (!full) {
      setShown(9999);
      return;
    }
    if (i + 1 >= lines.length) onDone();
    else setI(i + 1);
  };
  if (!line) return null;
  return (
    <div className="dialogue" onClick={advance}>
      <div className="dlg-box panel">
        <div className="dlg-who">{line.who}</div>
        <div className="dlg-text">{[...line.text].slice(0, shown).join('')}</div>
        <div className="dlg-next">{full ? (i + 1 >= lines.length ? '▶ 繼續' : '▼') : ''}</div>
      </div>
      <button className="dlg-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>
        略過 »
      </button>
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body panel" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div key={toast.id} className="toast">
      {toast.text}
    </div>
  );
}

export function go(s: Parameters<typeof store.go>[0]): void {
  store.go(s);
}
