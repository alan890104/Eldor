import { Component, useEffect, type ReactNode } from 'react';
import type { Stage } from '../render/stage.ts';
import { synth } from '../audio/sfx.ts';
import { music } from '../audio/music.ts';
import { store, useStore } from './store.ts';
import { bootSync, installAutoSync, setCloudNotice } from '../game/cloud.ts';
import { applyQuality, setStage, Toast } from './widgets.tsx';
import { HelpOverlay } from './Help.tsx';
import { showPop, TermPop } from './glossary.tsx';
import { KitNotice, noticeIfRepaired } from './KitNotice.tsx';
import { EndingScreen, StoryScreen, TitleScreen } from './screens/Intro.tsx';
import { PrologueScreen } from './screens/Prologue.tsx';
import { HubScreen, MapScreen, PartyScreen } from './screens/World.tsx';
import { FieldScreen } from './screens/Field.tsx';
import { TowerScreen } from './screens/Tower.tsx';
import { BattleScreen, ResultScreen } from './screens/Battle.tsx';
import { TeamScreen } from './screens/Team.tsx';
import { SummonScreen } from './screens/Summon.tsx';
import { ArenaScreen, DexScreen, QuestScreen, SettingsScreen } from './screens/Misc.tsx';
import './uiScale.ts';

export function App({ stage }: { stage: Stage }) {
  setStage(stage);
  const { sid } = useStore();
  useEffect(() => showPop(null), [sid]);
  useEffect(() => {
    const s = store.save.settings;
    synth.volume.sfx = s.sfx;
    synth.volume.music = s.music;
    const qs = new URLSearchParams(location.search);
    if (!qs.has('lowfx') && !qs.has('hq')) applyQuality(stage, s.lowfx ? 'low' : s.quality);
    stage.onAutoQuality = (q) => store.showToast(`畫面有點卡，已自動切換為${q === 'medium' ? '中等' : '省電'}畫質（可在設定調整）`);
    const unlock = () => {
      synth.unlock();
      synth.setVolumes();
      music.resume();
    };
    window.addEventListener('pointerdown', unlock);
    // Cloud save: sync once at boot (the title screen waits for it), then schedule an upload after every save
    setCloudNotice((t) => store.showToast(t));
    installAutoSync(() => store.save);
    void bootSync(store.save).then((r) => {
      if (r.decision !== 'useCloud' || !r.cloud) return;
      if (store.screen.name === 'title') {
        noticeIfRepaired(r.cloud);
        store.adoptSave(r.cloud);
        store.showToast('已載入雲端進度');
      } else store.showToast('雲端有較新的進度，回到標題畫面重新載入');
    });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [stage]);
  return (
    <>
      <ErrorBoundary key={sid}>
        <Screen />
      </ErrorBoundary>
      <HelpOverlay />
      <TermPop />
      <Toast />
      <KitNotice />
      <RotateGate />
    </>
  );
}

/** Touch devices (phones, tablets): when held upright, ask the player to rotate, and try to switch straight to landscape fullscreen */
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse), (hover: none)').matches;

/** Fullscreen + landscape lock. Android only allows locking the orientation after going fullscreen; iPhone supports neither, so all we can do is show a prompt asking the player to rotate the phone */
async function forceLandscape(): Promise<void> {
  const el = document.documentElement;
  if (!document.fullscreenElement && document.fullscreenEnabled) await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  await o?.lock?.('landscape').catch(() => {});
}

/**
 * Eldor has only a landscape layout: a portrait screen (orientation: portrait) is always covered by a prompt, and CSS decides whether it shows.
 * On a touch device the first tap tries to switch to landscape fullscreen; if the browser refuses, this overlay is all we have.
 */
function RotateGate() {
  useEffect(() => {
    if (!TOUCH) return;
    // Fullscreen needs a user gesture, and for touch only pointerup counts
    const first = () => void forceLandscape();
    window.addEventListener('pointerup', first, { once: true });
    return () => window.removeEventListener('pointerup', first);
  }, []);
  return (
    <div className={`rotate-gate ${TOUCH ? 'touch' : 'desk'}`} aria-live="polite">
      <div className="rg-phone" />
      <div className="rg-title">{TOUCH ? '請將手機橫放' : '請把視窗拉寬'}</div>
      <div className="rg-sub">艾爾多只能以橫向畫面遊玩</div>
      {TOUCH && document.fullscreenEnabled && (
        <button className="btn rg-go" onClick={() => void forceLandscape()}>
          切換成橫向全螢幕
        </button>
      )}
    </div>
  );
}

function Screen() {
  const { screen: s } = useStore();
  switch (s.name) {
    case 'title':
      return <TitleScreen />;
    case 'story':
      return <StoryScreen lines={s.lines} bg={s.bg} next={s.next} />;
    case 'prologue':
      return <PrologueScreen next={s.next} />;
    case 'hub':
      return <HubScreen />;
    case 'map':
      return <MapScreen />;
    case 'region':
      return <FieldScreen idx={s.idx} />;
    case 'tower':
      return <TowerScreen idx={s.idx} />;
    case 'party':
      return <PartyScreen purpose={s.purpose} onGo={s.onGo} back={s.back} cap={s.cap} foes={s.foes} foeTitle={s.foeTitle} />;
    case 'battle':
      return <BattleScreen setup={s.setup} onEnd={s.onEnd} tutorial={s.tutorial} />;
    case 'result':
      return <ResultScreen info={s.info} />;
    case 'team':
      return <TeamScreen uid={s.uid} tab={s.tab} from={s.from} />;
    case 'summon':
      return <SummonScreen tutorial={s.tutorial} />;
    case 'arena':
      return <ArenaScreen />;
    case 'dex':
      return <DexScreen />;
    case 'quests':
      return <QuestScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'ending':
      return <EndingScreen />;
    default:
      return null;
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="modal">
          <div className="modal-body panel">
            <h3>發生了一點問題</h3>
            <p>{String(this.state.error.message)}</p>
            <button className="btn small" onClick={() => store.go({ name: 'hub' })}>返回星門城</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
