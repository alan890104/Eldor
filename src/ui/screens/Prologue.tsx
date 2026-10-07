// The prologue animation screen: the 3D performance is left to render/prologue; this file only handles subtitles, title cards, skipping (button, long press, double tap) and fades.

import { useEffect, useRef, useState } from 'react';
import { PrologueScene } from '../../render/prologue/index.ts';
import type { Line } from '../../render/prologue/script.ts';
import { prologueMusic } from '../../audio/prologueMusic.ts';
import { music } from '../../audio/music.ts';
import { sfx, synth } from '../../audio/sfx.ts';
import { getStage } from '../widgets.tsx';
import { store } from '../store.ts';
import '../prologue.css';

const HOLD_MS = 900;

/** Colors for nouns in the subtitles: the few terms the player has to remember */
const TERM_COLOR: Record<string, string> = {
  虛蝕: '#c890ff',
  碎心之夜: '#ff9ac8',
  精靈: '#9ae8c0',
  契約: '#ffd97a',
  契印: '#ffd97a',
  源晶: '#8fe0ff',
  聖靈: '#ffe6a0',
  艾爾達林: '#ffd97a',
};

function Subtitle({ line }: { line: Line }) {
  const i = line.term ? line.text.indexOf(line.term) : -1;
  if (!line.term || i < 0) return <>{line.text}</>;
  return (
    <>
      {line.text.slice(0, i)}
      <em className="pro-term" style={{ color: TERM_COLOR[line.term] ?? '#ffd97a' }}>
        {line.term}
      </em>
      {line.text.slice(i + line.term.length)}
    </>
  );
}

/** startBeat: which beat to start from (dev preview); onScene: receives the 3D scene (dev tools use it to fast-forward for screenshots) */
export function PrologueScreen({ next, startBeat, onScene }: { next: () => void; startBeat?: number; onScene?: (sc: PrologueScene) => void }) {
  const [line, setLine] = useState<Line | null>(null);
  const [shown, setShown] = useState(false);
  const [fade, setFade] = useState<'in' | 'none' | 'out'>('in');
  const [hold, setHold] = useState(0);
  const scene = useRef<PrologueScene | null>(null);
  const finished = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const lastTap = useRef(0);
  const nextRef = useRef(next);
  nextRef.current = next;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    scene.current?.stop();
    prologueMusic.stop(0.7);
    setShown(false);
    setFade('out');
    window.setTimeout(() => nextRef.current(), 700);
  };

  useEffect(() => {
    music.play('none');
    const stage = getStage();
    const q = new URLSearchParams(location.search);
    const low = q.has('lowfx') || (!q.has('hq') && (store.save.settings.lowfx || stage.quality === 'low'));
    const sc = new PrologueScene(
      stage,
      {
        onLine: (l) => {
          if (l) setLine(l);
          setShown(!!l);
        },
        onDone: finish,
      },
      { low, startBeat },
    );
    scene.current = sc;
    onScene?.(sc);
    const startAudio = () => {
      if (!prologueMusic.running && synth.ctx && synth.ctx.state === 'running') prologueMusic.start(sc.t);
    };
    synth.unlock();
    startAudio();
    const unlock = () => {
      synth.unlock();
      window.setTimeout(startAudio, 50);
    };
    window.addEventListener('pointerdown', unlock);
    const off = stage.add(() => prologueMusic.tick(sc.t));
    sc.start();
    const fadeT = window.setTimeout(() => setFade('none'), 60);
    return () => {
      window.clearTimeout(fadeT);
      off();
      window.removeEventListener('pointerdown', unlock);
      prologueMusic.stop(0.3);
      sc.dispose();
      scene.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearHold = () => {
    if (holdTimer.current !== null) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHold(0);
  };
  const onDown = () => {
    const now = performance.now();
    if (now - lastTap.current < 380) {
      sfx.click();
      finish();
      return;
    }
    lastTap.current = now;
    clearHold();
    const t0 = now;
    holdTimer.current = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / HOLD_MS);
      setHold(k);
      if (k >= 1) {
        clearHold();
        sfx.click();
        finish();
      }
    }, 40);
  };

  return (
    <div className={`screen prologue fade-${fade}`} onPointerDown={onDown} onPointerUp={clearHold} onPointerCancel={clearHold} onPointerLeave={clearHold}>
      {line && !line.card && (
        <div className={`pro-sub ${shown ? 'on' : ''}`} key={line.at}>
          <Subtitle line={line} />
        </div>
      )}
      {line && line.card && (
        <div className={`pro-card ${shown ? 'on' : ''}`} key={line.at}>
          {line.text}
        </div>
      )}
      <button className="pro-skip" onPointerDown={(e) => e.stopPropagation()} onClick={() => { sfx.click(); finish(); }}>
        略過 »
      </button>
      <div className={`pro-hold ${hold > 0.08 ? 'on' : ''}`}>
        <div className="pro-hold-bar" style={{ transform: `scaleX(${hold})` }} />
        <span>按住略過</span>
      </div>
      <div className="pro-fade" />
    </div>
  );
}
