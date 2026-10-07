// Dev only: play the prologue animation on its own (add ?prologue to the URL). &beat=N starts from section N (0 Night of the Shattered Heart, 1 title, 2 the lost world, 3 aftermath, 4 present),
// &lowfx / &hq quality. window.__prologue: { beat, t, phase: 'play' | 'stop' | 'done', fps }.
// window.__prologueSeek(t): fast-forward to second t and hold (for checking the storyboard in screenshots). window.__stage: for switching quality at run time and measuring fps.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { Stage } from '../render/stage.ts';
import { setStage } from '../ui/widgets.tsx';
import { PrologueScreen } from '../ui/screens/Prologue.tsx';

export function runPrologueView(el: HTMLElement): void {
  const q = new URLSearchParams(location.search);
  const host = document.createElement('div');
  host.className = 'stage-host';
  el.appendChild(host);
  const stage = new Stage(host);
  stage.autoQuality = false;
  if (q.has('lowfx')) stage.setQuality('low');
  else if (q.has('hq')) stage.setQuality('high');
  setStage(stage);
  stage.start();
  (window as unknown as { __stage: Stage }).__stage = stage;
  const ui = document.createElement('div');
  ui.className = 'ui-root';
  el.appendChild(ui);
  const root = createRoot(ui);
  const startBeat = Number(q.get('beat') ?? '0');
  root.render(
    createElement(PrologueScreen, {
      startBeat,
      onScene: (sc) => {
        (window as unknown as { __prologueSeek: (t: number) => void }).__prologueSeek = (t) => sc.seek(t);
      },
      next: () => {
        root.render(createElement('div', { className: 'screen', style: { display: 'grid', placeItems: 'center', fontFamily: 'var(--serif)', fontSize: 28, letterSpacing: 6 } }, '序章結束'));
        (window as unknown as { __prologue: unknown }).__prologue = { beat: 'end', t: 0, phase: 'done' };
      },
    }),
  );
}
