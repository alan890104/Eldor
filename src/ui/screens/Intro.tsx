// Title, story (opening and First Pact) and ending.

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { EndingScene, HubScene, ShowcaseScene, TitleScene } from '../../render/scenes.ts';
import { SPIRITS } from '../../data.ts';
import { music } from '../../audio/music.ts';
import { sfx, synth } from '../../audio/sfx.ts';
import { PROLOGUE, type Line } from '../../game/campaign.ts';
import { clearSave, partySpirits } from '../../game/save.ts';
import type { RegionId } from '../../render/arena.ts';
import { store, useStore } from '../store.ts';
import { useCloud } from '../../game/cloud.ts';
import { Dialogue, Modal, useScene } from '../widgets.tsx';
import { continueGame, showPrologue, showStory, signFirstContract } from '../flows.ts';

export function TitleScreen() {
  const scene = useScene((s) => new TitleScene(s), []);
  // Spirits stand on both sides of the logo and the buttons: measure the half-width of the central UI column and hand it to the scene, recomputing when the window is resized
  useEffect(() => {
    if (!scene) return;
    const fit = () => {
      const w = window.innerWidth;
      let half = 0;
      for (const el of document.querySelectorAll('.title-screen .logo, .title-screen .title-buttons')) {
        const r = el.getBoundingClientRect();
        half = Math.max(half, Math.abs(r.left - w / 2), Math.abs(r.right - w / 2));
      }
      scene.keepClear(half / (w / 2) + 0.02);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [scene]);
  const { save } = useStore();
  const cloud = useCloud();
  const [confirm, setConfirm] = useState(false);
  const has = store.hasSave && save.starter;
  const syncing = cloud.booting;
  useEffect(() => music.play('title'), []);
  const start = () => {
    synth.unlock();
    music.resume();
    sfx.confirm();
    if (has) {
      setConfirm(true);
      return;
    }
    newGame();
  };
  const newGame = () => {
    clearSave();
    store.reset();
    // Play the prologue animation first (the origin of the world); whether watched or skipped, it leads into the hub town's opening dialogue
    showPrologue(() => showStory(PROLOGUE, 'hub', signFirstContract));
  };
  /** Rewatch the prologue: return to the title when it ends */
  const replay = () => {
    synth.unlock();
    sfx.click();
    showPrologue(() => store.go({ name: 'title' }));
  };
  return (
    <div className="screen title-screen" onPointerDown={() => { synth.unlock(); music.resume(); }}>
      <div className="logo">
        <div className="logo-sub">和精靈立約，修補碎裂的世界</div>
        <div className="logo-main">艾爾多</div>
        <div className="logo-en">E L D O R</div>
      </div>
      <div className="title-buttons">
        {has && (
          <button className="btn gold" disabled={syncing} onClick={() => { synth.unlock(); music.resume(); sfx.confirm(); continueGame(); }}>
            {syncing ? '雲端同步中…' : '繼續冒險'}
          </button>
        )}
        <button className={`btn ${has ? 'ghost' : 'gold'}`} disabled={syncing} onClick={start}>
          {has ? '重新開始' : syncing ? '雲端同步中…' : '開始冒險'}
        </button>
        {cloud.enabled && !syncing && cloud.status === 'error' && <div className="title-cloud err">雲端備份暫時無法連線，先使用本機進度</div>}
      </div>
      <div className="title-foot gsep"><span>點擊開始</span><span>建議開啟聲音</span></div>
      {!syncing && (
        <button className="btn ghost small title-replay" onClick={replay}>
          觀看序章
        </button>
      )}
      {confirm && (
        <Modal onClose={() => setConfirm(false)}>
          <h3>重新開始？</h3>
          <p>目前的存檔會被清除，無法復原。</p>
          <div className="row">
            <button className="btn ghost small" onClick={() => setConfirm(false)}>取消</button>
            <button className="btn small" onClick={newGame}>確定重新開始</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function StoryScreen({ lines, bg, next }: { lines: Line[]; bg: RegionId; next: () => void }) {
  // Hub town story: the partners you have pacted with stand in the plaza (empty before the opening pact; after it, Eldarin is at your side).
  // With partners present the camera goes lower and closer so they stand above the dialogue box, with the Star Gate left in the background
  useScene((s) => {
    if (bg !== 'hub') return new ShowcaseScene(s, 0, bg);
    const cast = partySpirits(store.save).map((p) => ({ speciesId: p.speciesId, stage: p.stage }));
    const sc = new HubScene(s, cast);
    // On a phone in landscape the dialogue box takes the lower 40% of the screen: pull the camera back and look down so the whole partner stands above the box
    const short = s.container.clientHeight < 560;
    if (cast.length) sc.rig.setBase(new THREE.Vector3(-1.5, short ? 2.3 : 2.4, short ? 10 : 10.5), new THREE.Vector3(0.6, short ? -0.7 : 0.3, -4));
    return sc;
  }, [bg]);
  // Story scenes use that region's field track; the hub town uses the hub track
  useEffect(() => music.play(bg === 'hub' || bg === 'arena' ? 'hub' : `field:${bg}`), [bg]);
  return (
    <div className="screen">
      <Dialogue lines={lines} onDone={next} />
    </div>
  );
}

const CREDITS = [
  ['艾爾多 Eldor', ''],
  ['和精靈立約，修補碎裂的世界', ''],
  ['世界觀・系統・數值設計', 'Eldor 設計組'],
  ['3D 精靈（程序化建模）', `${SPIRITS.length} 種 × 三階段`],
  ['戰鬥引擎', '每隻精靈專屬的技能組・伏技連鎖'],
  ['音樂與音效', 'Web Audio 即時合成'],
  ['感謝遊玩', '你的冒險還會繼續'],
];

export function EndingScreen() {
  const { save } = useStore();
  useScene((s) => {
    const party = partySpirits(save);
    const seen = new Set(party.map((p) => p.speciesId));
    const others = save.spirits.filter((x) => !seen.has(x.speciesId) && (seen.add(x.speciesId), true)).sort((a, b) => b.level - a.level);
    return new EndingScene(s, party, others);
  }, []);
  useEffect(() => music.play('ending'), []);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 14000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="screen ending" onClick={() => done && store.go({ name: 'hub' })}>
      <div className="credits">
        {CREDITS.map(([a, b], i) => (
          <div key={i} className="credit" style={{ animationDelay: `${i * 1.8}s` }}>
            <div className="c1">{a}</div>
            {b && <div className="c2">{b}</div>}
          </div>
        ))}
      </div>
      {done && (
        <button className="btn gold ending-btn" onClick={() => store.go({ name: 'hub' })}>
          回到星門城
        </button>
      )}
    </div>
  );
}
