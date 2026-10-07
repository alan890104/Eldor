// Cloud backup (browser side): the player does not need to log in. The first time there is progress to save, an anonymous account is created automatically (one key, stored only on this device),
// after that every save is uploaded automatically; one sync is done at startup. The key can be carried to another device as a transfer code from "Advanced" in settings.
// The pure logic (which copy to use) is in cloudSync.ts; the server side is in worker/src/index.ts.

import { useSyncExternalStore } from 'react';
import type { SaveData } from './save.ts';
import { decide, hasProgress, isRealConflict, type CloudSave, type Decision } from './cloudSync.ts';

const KEY_LS = 'eldor-cloud-key';
const META_LS = 'eldor-cloud-meta';
/** The player turned off cloud backup in settings */
const OFF_LS = 'eldor-cloud-off';
/** API address: in production, same origin as the site (/api); in development Vite proxies it to wrangler dev (see vite.config.ts) */
const API = ((import.meta.env?.VITE_CLOUD_API as string | undefined) ?? '/api').replace(/\/$/, '');
const TIMEOUT_MS = 8000;
/** How long after a save with no further changes before uploading */
const DEBOUNCE_MS = 4000;
/** Cloud backup is only enabled if VITE_CLOUD=1 was set at build time (npm run cloud:deploy); a purely static deploy (npm run deploy) never connects to /api at all */
export const CLOUD_ON = (import.meta.env?.VITE_CLOUD as string | undefined) === '1';
/** Test saves (?devsave) do not touch the cloud */
const DISABLED = !CLOUD_ON || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('devsave'));

interface Meta {
  id: string;
  /** The last cloud rev seen */
  rev: number;
}

export interface CloudState {
  /** This device already has an account key */
  enabled: boolean;
  /** The player turned off cloud backup */
  off: boolean;
  id: string | null;
  status: 'idle' | 'syncing' | 'ok' | 'error';
  lastSync: number;
  error: string | null;
  /** Startup sync in progress: the title screen waits for it to finish before letting the player continue */
  booting: boolean;
  /** Another device wrote newer progress: waiting for the player to decide which copy to keep */
  conflict: CloudSave | null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ───────────────────────── Locally stored key and state ─────────────────────────

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function lsSet(k: string, v: string | null): void {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* Private mode and the like */
  }
}

function getKey(): string | null {
  return lsGet(KEY_LS);
}

function getMeta(): Meta {
  try {
    const m = JSON.parse(lsGet(META_LS) ?? '') as Partial<Meta>;
    return { id: m.id ?? '', rev: m.rev ?? 0 };
  } catch {
    return { id: '', rev: 0 };
  }
}

function setMeta(m: Meta): void {
  lsSet(META_LS, JSON.stringify(m));
}

// ───────────────────────── State (React subscribes via useCloud) ─────────────────────────

let state: CloudState = {
  enabled: !DISABLED && !!getKey(),
  off: lsGet(OFF_LS) === '1',
  id: getMeta().id || null,
  status: 'idle',
  lastSync: 0,
  error: null,
  booting: false,
  conflict: null,
};
const listeners = new Set<() => void>();
let notice: (text: string) => void = () => {};

function patch(p: Partial<CloudState>): void {
  state = { ...state, ...p };
  for (const l of listeners) l();
}

export function useCloud(): CloudState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => state,
  );
}

export function cloudState(): CloudState {
  return state;
}

/** Method to show a toast message (hooked up to store.showToast when the App starts) */
export function setCloudNotice(fn: (text: string) => void): void {
  notice = fn;
}

// ───────────────────────── API ─────────────────────────

async function api(path: string, init: RequestInit & { key?: string | null } = {}): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const headers: Record<string, string> = { ...((init.headers as Record<string, string> | undefined) ?? {}) };
  const key = init.key === undefined ? getKey() : init.key;
  if (key) headers.Authorization = `Bearer ${key}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(API + path, { ...init, headers, signal: ctl.signal });
  } catch (e) {
    throw new ApiError(0, e instanceof Error && e.name === 'AbortError' ? '連線逾時' : '無法連線到雲端');
  } finally {
    clearTimeout(timer);
  }
}

async function expectJson<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `伺服器錯誤（${r.status}）`;
    try {
      const j = (await r.json()) as { error?: string };
      if (j.error) msg = j.error === 'unauthorized' ? '金鑰無效' : j.error;
    } catch {
      /* Not JSON */
    }
    throw new ApiError(r.status, msg);
  }
  return (await r.json()) as T;
}

/** Turn cloud backup on or off (turning it off keeps the key, so it can be resumed later) */
export function setCloudOff(off: boolean): void {
  lsSet(OFF_LS, off ? '1' : null);
  patch({ off, status: 'idle', error: null });
}

/** Create an anonymous account; returns the key (given only this once) */
export async function createAccount(): Promise<string> {
  const r = await api('/account', { method: 'POST', key: null });
  const j = await expectJson<{ id: string; key: string }>(r);
  lsSet(KEY_LS, j.key);
  setMeta({ id: j.id, rev: 0 });
  patch({ enabled: true, id: j.id, status: 'idle', error: null, conflict: null });
  return j.key;
}

/** Log in on this device with an existing key */
export async function linkAccount(rawKey: string): Promise<string> {
  const key = rawKey.trim();
  const r = await api('/me', { key });
  const j = await expectJson<{ id: string }>(r);
  lsSet(KEY_LS, key);
  setMeta({ id: j.id, rev: 0 });
  patch({ enabled: true, id: j.id, status: 'idle', error: null, conflict: null });
  return j.id;
}

/** Log out: forget the key, local progress is kept */
export function unlink(): void {
  lsSet(KEY_LS, null);
  lsSet(META_LS, null);
  patch({ enabled: false, id: null, status: 'idle', error: null, conflict: null, lastSync: 0 });
}

export function currentKey(): string | null {
  return getKey();
}

export async function pull(): Promise<CloudSave | null> {
  const r = await api('/save');
  if (r.status === 204) return null;
  return expectJson<CloudSave>(r);
}

type PushResult = { ok: true; rev: number } | { ok: false; cloud: CloudSave | null };

async function push(save: SaveData, baseRev: number, keepalive = false): Promise<PushResult> {
  const r = await api('/save', { method: 'PUT', body: JSON.stringify({ rev: baseRev, updatedAt: save.updatedAt, data: save }), keepalive });
  if (r.status === 409) {
    const j = (await r.json()) as CloudSave & { data: SaveData | null };
    return { ok: false, cloud: j.data ? { rev: j.rev, updatedAt: j.updatedAt, data: j.data } : null };
  }
  const j = await expectJson<{ rev: number }>(r);
  return { ok: true, rev: j.rev };
}

export async function deleteCloudSave(): Promise<void> {
  const r = await api('/save', { method: 'DELETE' });
  if (!r.ok && r.status !== 204) throw new ApiError(r.status, '刪除失敗');
  setMeta({ ...getMeta(), rev: 0 });
}

// ───────────────────────── Sync ─────────────────────────

function fail(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  patch({ status: 'error', error: msg });
}

/**
 * Startup sync: download first, then decide which copy to use. Returns the decision and (when it is to be loaded) the cloud save; the caller is responsible for plugging it into the store.
 * On failure it does not throw, only marks the state as error, and the game carries on with the local save.
 */
export async function bootSync(local: SaveData): Promise<{ decision: Decision; cloud: SaveData | null }> {
  if (!state.enabled || state.off) return { decision: 'same', cloud: null };
  patch({ status: 'syncing', booting: true, error: null });
  try {
    const cloud = await pull();
    const decision = decide(local, cloud);
    if (decision === 'useCloud' && cloud) {
      setMeta({ ...getMeta(), rev: cloud.rev });
      patch({ status: 'ok', lastSync: Date.now(), booting: false, conflict: null });
      return { decision, cloud: cloud.data };
    }
    if (decision === 'pushLocal') {
      const res = await push(local, cloud?.rev ?? 0);
      if (res.ok) setMeta({ ...getMeta(), rev: res.rev });
      else throw new ApiError(409, '雲端剛被其他裝置更新，請重新整理');
    } else if (cloud) setMeta({ ...getMeta(), rev: cloud.rev });
    patch({ status: 'ok', lastSync: Date.now(), booting: false, conflict: null });
    return { decision, cloud: null };
  } catch (e) {
    fail(e);
    patch({ booting: false });
    return { decision: 'same', cloud: null };
  }
}

/** In-play upload (upload only, no download); creates the account along the way the first time there is progress; when rejected, it counts as a conflict only if the cloud copy is newer */
export async function pushNow(save: SaveData, keepalive = false): Promise<void> {
  if (DISABLED || state.off || state.conflict) return;
  if (!hasProgress(save) && !state.enabled) return;
  patch({ status: 'syncing', error: null });
  try {
    if (!state.enabled) await createAccount();
    let res = await push(save, getMeta().rev, keepalive);
    if (!res.ok && !isRealConflict(save, res.cloud)) {
      // Only the rev is stale (e.g. another tab on the same device): retry with the cloud's rev
      setMeta({ ...getMeta(), rev: res.cloud?.rev ?? 0 });
      res = await push(save, res.cloud?.rev ?? 0, keepalive);
    }
    if (res.ok) {
      setMeta({ ...getMeta(), rev: res.rev });
      patch({ status: 'ok', lastSync: Date.now() });
    } else {
      patch({ status: 'error', error: '另一台裝置有較新的進度', conflict: res.cloud });
      notice('雲端有另一台裝置的較新進度，請到「設定」決定要保留哪一份');
    }
  } catch (e) {
    fail(e);
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let source: (() => SaveData) | null = null;

/** Schedule an upload after a save: several saves in a short time upload only the last one */
export function scheduleSync(getSave: () => SaveData): void {
  source = getSave;
  if (DISABLED || state.off) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void pushNow(getSave());
  }, DEBOUNCE_MS);
}

/** Upload the queued save immediately (when closing the tab or switching to the background) */
function flush(keepalive: boolean): void {
  if (!timer || !source) return;
  clearTimeout(timer);
  timer = null;
  void pushNow(source(), keepalive);
}

/** Manual sync: send what is pending first, then download once to confirm the state */
export async function syncNow(getSave: () => SaveData, adopt: (d: SaveData) => void): Promise<void> {
  if (state.off) return;
  if (!state.enabled) {
    await pushNow(getSave());
    return;
  }
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const local = getSave();
  patch({ status: 'syncing', error: null });
  try {
    const cloud = await pull();
    const decision = decide(local, cloud);
    if (decision === 'useCloud' && cloud) {
      patch({ status: 'error', error: '雲端有較新的進度', conflict: cloud });
      return;
    }
    if (decision === 'pushLocal') {
      const res = await push(local, cloud?.rev ?? 0);
      if (!res.ok) throw new ApiError(409, '雲端剛被其他裝置更新');
      setMeta({ ...getMeta(), rev: res.rev });
    } else if (cloud) setMeta({ ...getMeta(), rev: cloud.rev });
    patch({ status: 'ok', lastSync: Date.now(), conflict: null });
    void adopt;
  } catch (e) {
    fail(e);
  }
}

/** Resolve a conflict: load the cloud copy, or overwrite the cloud with the local one */
export async function resolveConflict(choice: 'cloud' | 'local', getSave: () => SaveData, adopt: (d: SaveData) => void): Promise<void> {
  const c = state.conflict;
  if (!c) return;
  if (choice === 'cloud') {
    setMeta({ ...getMeta(), rev: c.rev });
    patch({ conflict: null, status: 'ok', error: null, lastSync: Date.now() });
    adopt(c.data);
    return;
  }
  patch({ conflict: null, status: 'syncing', error: null });
  try {
    const local = getSave();
    let res = await push(local, c.rev);
    if (!res.ok) res = await push(local, res.cloud?.rev ?? 0);
    if (!res.ok) throw new ApiError(409, '雲端一直在變動，請稍後再試');
    setMeta({ ...getMeta(), rev: res.rev });
    patch({ status: 'ok', lastSync: Date.now() });
  } catch (e) {
    fail(e);
  }
}

/** First sync after logging in with a key: if the cloud has progress, load it; if not, upload the local one */
export async function syncAfterLink(getSave: () => SaveData, adopt: (d: SaveData) => void): Promise<'loaded' | 'uploaded' | 'none'> {
  patch({ status: 'syncing', error: null });
  try {
    const cloud = await pull();
    if (cloud && hasProgress(cloud.data)) {
      setMeta({ ...getMeta(), rev: cloud.rev });
      patch({ status: 'ok', lastSync: Date.now(), conflict: null });
      adopt(cloud.data);
      return 'loaded';
    }
    const local = getSave();
    if (hasProgress(local)) {
      const res = await push(local, cloud?.rev ?? 0);
      if (!res.ok) throw new ApiError(409, '雲端剛被其他裝置更新');
      setMeta({ ...getMeta(), rev: res.rev });
      patch({ status: 'ok', lastSync: Date.now(), conflict: null });
      return 'uploaded';
    }
    patch({ status: 'ok', lastSync: Date.now(), conflict: null });
    return 'none';
  } catch (e) {
    fail(e);
    throw e;
  }
}

/** Attach "upload when leaving the page"; called once when the App starts */
export function installAutoSync(getSave: () => SaveData): void {
  if (typeof window === 'undefined') return;
  source = getSave;
  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
}
