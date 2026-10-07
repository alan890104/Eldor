import { createRoot } from 'react-dom/client';
import { Stage } from '../render/stage.ts';
import { synth } from '../audio/sfx.ts';
import { App } from './App.tsx';
import { watchUpdates } from './update.ts';

export let stage: Stage;

export function boot(el: HTMLElement): void {
  watchUpdates();
  const host = document.createElement('div');
  host.className = 'stage-host';
  el.appendChild(host);
  stage = new Stage(host);
  const q = new URLSearchParams(location.search);
  if (q.has('lowfx') || q.has('hq')) {
    stage.setQuality(q.has('hq') ? 'high' : 'low');
    stage.autoQuality = false;
  }
  if (q.has('testclock')) stage.maxDt = 1;
  (window as unknown as { __stage: Stage }).__stage = stage;
  stage.start();
  const ui = document.createElement('div');
  ui.className = 'ui-root';
  el.appendChild(ui);
  const unlock = () => synth.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  createRoot(ui).render(<App stage={stage} />);
  el.querySelector('.boot-loading')?.remove();
}
