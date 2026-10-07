// Dev only: preview the Star Gate Summon cutscene on its own (does not touch the save). Add ?summonview to the URL.
// Params: &res=SSR:ignisar,SR:phoenix,R:inkcat (set each pull), or &n=10&best=SSR (n random pulls with best as the top rarity; the SSR goes at the &at= position, last by default)
//       &fake=1 (the meteor first poses as purple, then upgrades to gold), &kind=new|resonance|stardust (by default a first appearance is new and a duplicate is resonance)
//       &lowfx / &hq (quality), &audiotest=1 (render the SSR sound effects and fanfare offline and measure the peak into window.__audio)
// window.__summon: { phase: 'intro' | 'reveal' | 'summary' | 'done', t0 }, where t0 is the performance.now() at which the cutscene started.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { Stage } from '../render/stage.ts';
import { SummonScene } from '../render/summon/index.ts';
import { SPIRITS } from '../data.ts';
import { synth } from '../audio/sfx.ts';
import { music } from '../audio/music.ts';
import { summonSfx } from '../audio/summonSfx.ts';
import { summonMusic } from '../audio/summonMusic.ts';
import type { PullResult } from '../game/gachaGame.ts';
import type { Rarity } from '../../sim/types.ts';
import { SummonPlay } from '../ui/screens/Summon.tsx';

const pick = (r: Rarity, used: Set<string>): string => {
  const pool = SPIRITS.filter((s) => s.rarity === r && !used.has(s.id));
  const all = pool.length ? pool : SPIRITS.filter((s) => s.rarity === r);
  return all[Math.floor(Math.random() * all.length)].id;
};

function parseResults(q: URLSearchParams): PullResult[] {
  const kindParam = q.get('kind') as PullResult['kind'] | null;
  const seen = new Set<string>();
  const mk = (rarity: Rarity, speciesId: string): PullResult => {
    const kind = kindParam ?? (seen.has(speciesId) ? 'resonance' : 'new');
    seen.add(speciesId);
    return { speciesId, rarity, kind, featured: false };
  };
  const res = q.get('res');
  if (res) {
    return res.split(',').filter(Boolean).map((s) => {
      const [r, id] = s.split(':');
      const rarity = (r.toUpperCase() as Rarity) || 'R';
      return mk(rarity, id || pick(rarity, seen));
    });
  }
  const n = Math.max(1, Number(q.get('n') ?? 1));
  const best = (q.get('best') ?? 'R').toUpperCase() as Rarity;
  const at = Math.min(n - 1, Number(q.get('at') ?? n - 1));
  const out: PullResult[] = [];
  for (let i = 0; i < n; i++) {
    let rarity: Rarity = 'R';
    if (i === at) rarity = best;
    else if (best !== 'R' && Math.random() < 0.25) rarity = 'SR';
    if (i !== at && rarity === best && best === 'SSR') rarity = 'SR';
    out.push(mk(rarity, pick(rarity, seen)));
  }
  return out;
}

/** Offline render: the whole SSR reveal sound set (burst, roar, brass stab, fanfare theme), four seconds, measuring the peak */
async function audioTest(el: string): Promise<void> {
  const sr = 44100;
  const off = new OfflineAudioContext(2, sr * 5, sr);
  synth.attach(off as unknown as AudioContext);
  summonMusic.start();
  summonSfx.burst('SSR');
  setTimeout(() => {}, 0);
  summonSfx.roar(el as 'fire');
  summonSfx.stinger('SSR');
  summonMusic.cue('ssr', el as 'fire');
  summonSfx.gateOpen();
  const buf = await off.startRendering();
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      sum += d[i] * d[i];
      n++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  (window as unknown as { __audio: unknown }).__audio = { peak, peakDb: 20 * Math.log10(Math.max(1e-9, peak)), rmsDb: 20 * Math.log10(Math.max(1e-9, rms)), clipped: peak >= 0.999 };
  summonMusic.stop();
}

export async function runSummonView(el: HTMLElement): Promise<void> {
  const q = new URLSearchParams(location.search);
  const state = { phase: 'intro', t0: performance.now() };
  (window as unknown as { __summon: typeof state }).__summon = state;
  if (q.has('audiotest')) {
    await audioTest(q.get('audiotest') || 'fire');
    return;
  }
  const host = document.createElement('div');
  host.className = 'stage-host';
  el.appendChild(host);
  const stage = new Stage(host);
  stage.autoQuality = false;
  if (q.has('lowfx')) stage.setQuality('low');
  else if (q.has('hq')) stage.setQuality('high');
  (window as unknown as { __stage: Stage }).__stage = stage;
  stage.start();
  const ui = document.createElement('div');
  ui.className = 'ui-root';
  el.appendChild(ui);
  const unlock = () => {
    synth.unlock();
    music.play('summon');
  };
  window.addEventListener('pointerdown', unlock);
  const scene = new SummonScene(stage);
  const results = parseResults(q);
  const fake = q.has('fake') ? q.get('fake') !== '0' : undefined;
  const root = createRoot(ui);
  const render = () =>
    root.render(
      createElement(SummonPlay, {
        scene,
        results,
        fake,
        onPhase: (p: string) => {
          state.phase = p;
        },
        onDone: () => {
          scene.clearReveal();
          state.phase = 'done';
          root.render(createElement('div', { className: 'screen', style: { pointerEvents: 'auto' } }, createElement('button', { className: 'btn gold', style: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }, onClick: () => { state.phase = 'intro'; state.t0 = performance.now(); render(); } }, '再抽一次')));
        },
      }),
    );
  render();
}
