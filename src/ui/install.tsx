// A phone must install the game as an app (PWA) to play: the browser's address bar and toolbar eat a big chunk of the landscape screen, so it can't really be played there.
// When a phone (touch, short screen side ≤ 540) opens it in the browser, an install prompt covers the whole screen; only opening from the home screen (fullscreen or standalone window) gets into the game.
// - Chrome, Edge and Samsung Internet on Android: intercept beforeinstallprompt, and the button opens the install dialog directly.
// - Android browsers that haven't received the install event yet: tell the player to install from the top-right menu.
// - iPhone: Safari has no install event, so all we can do is tell the player to use "Add to Home Screen" from the share button.
// - In-app browsers such as LINE, Facebook and Instagram can't install, so first ask the player to switch to Safari or Chrome.
// Add ?nopwa to the URL to skip it (for development testing).

import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

// Start listening as soon as the module loads: the install event can arrive before the screen mounts
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

const UA = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const IOS = /iPhone|iPod/.test(UA);
const ANDROID = /Android/.test(UA);
/** In-app browsers (cannot install a PWA) */
const IN_APP = /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|Messenger|KAKAOTALK|Threads/i.test(UA);
const IOS_SAFARI = IOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(UA) && !IN_APP;

function isPhone(): boolean {
  if (typeof matchMedia !== 'function') return false;
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  return touch && Math.min(screen.width, screen.height) <= 540;
}

function isStandalone(): boolean {
  if (typeof matchMedia !== 'function') return false;
  return (
    matchMedia('(display-mode: fullscreen)').matches ||
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Does the install prompt need to cover the screen (phone, not opened from the home screen, no ?nopwa) */
export const NEEDS_INSTALL = typeof window !== 'undefined' && isPhone() && !isStandalone() && !new URLSearchParams(location.search).has('nopwa');

function ShareIcon() {
  return (
    <svg className="ig-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10H6v10h12V10h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="ig-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="19" r="2" fill="currentColor" />
    </svg>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="ig-steps">
      {items.map((it, i) => (
        <li key={i}>
          <span className="ig-num">{i + 1}</span>
          <span className="ig-step">{it}</span>
        </li>
      ))}
    </ol>
  );
}

const OPEN_STEP = '回到主畫面，點艾爾多的圖示開始玩';

function Body() {
  const [, force] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);

  if (installed) {
    return <p className="ig-done">安裝好了！請回到主畫面，點艾爾多的圖示開始玩。</p>;
  }
  if (deferred) {
    const ask = async () => {
      const p = deferred;
      if (!p) return;
      await p.prompt();
      const { outcome } = await p.userChoice;
      if (outcome === 'accepted') installed = true;
      deferred = null;
      notify();
    };
    return (
      <button className="btn gold ig-go" onClick={() => void ask()}>
        安裝到主畫面
      </button>
    );
  }
  if (IN_APP) {
    const url = location.href;
    const copy = () => {
      void navigator.clipboard?.writeText(url).then(() => setCopied(true));
    };
    const openOutside = () => {
      if (/\bLine\//i.test(UA)) {
        const u = new URL(url);
        u.searchParams.set('openExternalBrowser', '1');
        location.href = u.toString();
      } else if (ANDROID) {
        location.href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
      }
    };
    const canOpen = /\bLine\//i.test(UA) || ANDROID;
    return (
      <>
        <p className="ig-note">這個 App 內建的瀏覽器沒辦法安裝，請改用{IOS ? ' Safari ' : ' Chrome '}開啟這個網頁。</p>
        <div className="ig-row">
          {canOpen && (
            <button className="btn gold ig-go" onClick={openOutside}>
              用{IOS ? ' Safari ' : ' Chrome '}開啟
            </button>
          )}
          <button className={`btn ${canOpen ? '' : 'gold'} ig-go`} onClick={copy}>
            {copied ? '已複製網址' : '複製網址'}
          </button>
        </div>
      </>
    );
  }
  if (IOS) {
    return (
      <Steps
        items={[
          <>
            {IOS_SAFARI ? '點畫面下方的分享按鈕，沒看到就先點「⋯」' : '點網址列旁邊的分享按鈕'} <ShareIcon />
          </>,
          <>往下找到「加入主畫面」</>,
          OPEN_STEP,
        ]}
      />
    );
  }
  return (
    <Steps
      items={[
        <>
          點右上角的選單 <MenuIcon />
        </>,
        <>選「安裝應用程式」或「加到主畫面」</>,
        OPEN_STEP,
      ]}
    />
  );
}

/** The install prompt that replaces the whole game when a phone opens it in the browser; readable in both portrait and landscape */
export function mountInstallGate(el: HTMLElement): void {
  const ui = document.createElement('div');
  ui.className = 'ui-root';
  el.appendChild(ui);
  createRoot(ui).render(<InstallGate />);
  el.querySelector('.boot-loading')?.remove();
}

function InstallGate() {
  return (
    <div className="install-gate" role="dialog" aria-label="安裝艾爾多">
      <div className="ig-card">
        <img className="ig-icon" src="./icons/icon-192.png" alt="" />
        <div className="ig-text">
          <div className="ig-title">安裝艾爾多</div>
          <p className="ig-sub">手機請先把艾爾多安裝到主畫面再玩。在瀏覽器裡玩，網址列會擋掉一大塊畫面；裝好以後就是全螢幕。</p>
        </div>
      </div>
      <Body />
    </div>
  );
}
