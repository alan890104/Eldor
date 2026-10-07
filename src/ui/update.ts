// Version updates: after a new build is deployed, files that an old tab still open loads on demand (tracks, ultimates, models) are gone from the server.
// The server answers with a web page instead of code, so the load fails (e.g. battle music goes silent).
// When that happens, note that a new version is out: on safe screens (title, hub, world map) reload right away; during a battle or in the field show a notice first and reload once back on a safe screen.

import { store } from './store.ts';

const SAFE = new Set(['title', 'hub', 'map']);
const KEY = 'eldor-update-reload';

let stale = false;

function reload(): void {
  // If loading still fails after a reload (the edge cache has not refreshed yet), do not auto-reload again within a minute, to avoid a reload loop
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* Private mode: reload once anyway */
  }
  location.reload();
}

export function watchUpdates(): void {
  window.addEventListener('vite:preloadError', () => {
    if (stale) return;
    stale = true;
    if (SAFE.has(store.get().screen.name)) {
      reload();
      return;
    }
    store.showToast('遊戲已更新，回到主城時會自動重新載入');
    const off = store.subscribe(() => {
      if (!SAFE.has(store.get().screen.name)) return;
      off();
      reload();
    });
  });
}
