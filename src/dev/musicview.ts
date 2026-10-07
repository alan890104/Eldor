// Dev only: music listening room (add ?music to the URL, or ?music=field:volcano to play one directly). Audition the score of each scene, track by track.
// window.__bench(id, seconds): renders offline in the browser and returns the milliseconds it took (measures CPU load).

import { synth } from '../audio/sfx.ts';
import { music } from '../audio/music.ts';
import { GROUPS, loadSong, REGION_NAMES } from '../audio/music/catalog.ts';
import { renderOffline, type SongDef } from '../audio/music/engine.ts';
import { summonMusic } from '../audio/summonMusic.ts';

const GROUP_LABEL = (id: string): string => {
  const [kind, r] = id.split(':');
  if (!r) return id;
  const name = REGION_NAMES[r] ?? r;
  return kind === 'field' ? name : kind === 'tower' ? `${name}・伏魔塔` : `${name}・遭遇戰`;
};

export function runMusicView(el: HTMLElement): void {
  const q = new URLSearchParams(location.search);
  el.innerHTML = '';
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#0f1320;color:#e8e2cf;font:15px/1.5 system-ui,sans-serif;padding:20px 24px;';
  el.appendChild(root);
  root.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:14px">
      <h1 style="margin:0;font-size:22px;color:#f3d487">音樂鑑賞室</h1>
      <button id="mv-stop" style="padding:6px 16px">■ 停止</button>
      <label>音量 <input id="mv-vol" type="range" min="0" max="1" step="0.05" value="${synth.volume.music}"></label>
      <span style="opacity:.6">點任何一首開始播放（第一次會先準備樂器取樣）</span>
    </div>
    <div id="mv-now" style="min-height:92px;padding:12px 16px;border:1px solid #3a4260;border-radius:10px;background:#161b2c;margin-bottom:16px"></div>
    <div id="mv-list"></div>`;
  const list = root.querySelector('#mv-list')!;
  const now = root.querySelector<HTMLDivElement>('#mv-now')!;
  const defs = new Map<string, SongDef>();
  let playing = '';

  const show = (id: string) => {
    const d = defs.get(id);
    if (!d) {
      now.innerHTML = '<span style="opacity:.6">尚未播放</span>';
      return;
    }
    const meter = d.meter ?? 16;
    const sig = meter === 12 ? '3/4 或 6/8' : meter === 14 ? '7/8' : meter === 20 ? '5/4' : meter === 16 ? '4/4' : `${meter}/16`;
    const insts = [...new Set([...(d.intro ?? []), ...d.tracks].map((t) => t.name ?? t.inst))];
    now.innerHTML = `<div style="font-size:20px;color:#f3d487">${d.title} <span style="font-size:13px;opacity:.6">${id}</span></div>
      <div style="margin:4px 0 6px">${d.mood}</div>
      <div style="opacity:.75;font-size:13px">${d.bpm} BPM・${sig}・殘響 ${d.space.size}s　編制：${insts.join('、')}</div>`;
  };

  for (const [group, ids] of GROUPS) {
    const h = document.createElement('h2');
    h.textContent = group;
    h.style.cssText = 'font-size:16px;margin:14px 0 8px;color:#9fb4e8';
    list.appendChild(h);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
    list.appendChild(row);
    for (const id of ids) {
      const b = document.createElement('button');
      b.dataset.id = id;
      b.style.cssText = 'padding:8px 12px;border-radius:8px;border:1px solid #3a4260;background:#1c2338;color:inherit;cursor:pointer;min-width:120px;text-align:left';
      b.innerHTML = `<div>${GROUP_LABEL(id)}</div><div class="t" style="font-size:12px;opacity:.6">…</div>`;
      void loadSong(id).then((d) => {
        defs.set(id, d);
        b.querySelector('.t')!.textContent = d.title;
      });
      b.onclick = () => {
        synth.unlock();
        music.play(id);
        playing = id;
        for (const x of root.querySelectorAll<HTMLButtonElement>('button[data-id]')) x.style.borderColor = x.dataset.id === id ? '#f3d487' : '#3a4260';
        show(id);
      };
      row.appendChild(b);
    }
  }
  // Summon: send cue points in order, on the beats of the cutscene
  const sh = document.createElement('h2');
  sh.textContent = '星門召喚（依演出節拍自動跑一輪）';
  sh.style.cssText = 'font-size:16px;margin:14px 0 8px;color:#9fb4e8';
  list.appendChild(sh);
  const srow = document.createElement('div');
  srow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  list.appendChild(srow);
  const EL: [string, string][] = [['fire', '火'], ['water', '水'], ['nature', '自然'], ['thunder', '雷'], ['wind', '風'], ['earth', '地'], ['light', '光'], ['dark', '暗'], ['neutral', '無']];
  let timers: number[] = [];
  for (const [el, name] of EL) {
    const b = document.createElement('button');
    b.style.cssText = 'padding:8px 12px;border-radius:8px;border:1px solid #3a4260;background:#1c2338;color:inherit;cursor:pointer;min-width:90px';
    b.textContent = `${name}屬性 SSR`;
    b.onclick = () => {
      synth.unlock();
      timers.forEach(clearTimeout);
      music.play('summon');
      now.innerHTML = `<div style="font-size:20px;color:#f3d487">星門召喚・${name}屬性 SSR</div><div>待機循環 → 蓄力 → 流星 → 升金 → 開門 → SSR 號角與餘韻 → 結算 → 回到待機</div>`;
      const at = (sec: number, f: () => void) => timers.push(window.setTimeout(f, sec * 1000));
      at(4, () => summonMusic.cue('build', 1.3));
      at(5.3, () => summonMusic.cue('drop'));
      at(6.0, () => summonMusic.cue('upgrade'));
      at(6.6, () => summonMusic.cue('gate'));
      at(9.5, () => summonMusic.cue('ssr', el as 'fire'));
      at(19, () => summonMusic.cue('summary'));
    };
    srow.appendChild(b);
  }

  root.querySelector<HTMLButtonElement>('#mv-stop')!.onclick = () => {
    timers.forEach(clearTimeout);
    timers = [];
    music.stop();
    playing = '';
    show('');
  };
  root.querySelector<HTMLInputElement>('#mv-vol')!.oninput = (e) => {
    synth.volume.music = Number((e.target as HTMLInputElement).value);
    synth.setVolumes();
  };
  show('');
  const first = q.get('music');
  if (first) {
    const go = () => root.querySelector<HTMLButtonElement>(`button[data-id="${first}"]`)?.click();
    window.addEventListener('pointerdown', go, { once: true });
  }
  void playing;

  (window as unknown as { __bench: (id: string, s?: number) => Promise<number> }).__bench = async (id, s = 60) => {
    const def = await loadSong(id);
    await renderOffline(OfflineAudioContext, def, s, 44100);
    const t0 = performance.now();
    await renderOffline(OfflineAudioContext, def, s, 44100);
    return performance.now() - t0;
  };
  /** Measure CPU per track: play one track at a time */
  (window as unknown as { __benchTracks: (id: string, s?: number) => Promise<[string, number][]> }).__benchTracks = async (id, s = 30) => {
    const def = await loadSong(id);
    const out: [string, number][] = [];
    for (const tk of def.tracks) {
      await renderOffline(OfflineAudioContext, { ...def, intro: undefined, tracks: [tk] }, 1, 44100);
      const t0 = performance.now();
      await renderOffline(OfflineAudioContext, { ...def, intro: undefined, tracks: [tk] }, s, 44100);
      out.push([`${tk.name ?? ''}(${tk.inst})`, (performance.now() - t0) / (s * 10)]);
    }
    return out;
  };
}

/** Measure CPU per instrument: the same quarter-note melody (sustained instruments play a four-note chord as whole notes), no reverb send */
(window as unknown as { __benchInst: (names: string[], s?: number) => Promise<[string, number][]> }).__benchInst = async (names, s = 20) => {
  const { INSTRUMENTS } = await import('../audio/music/instruments.ts');
  const { mel, prog, pad } = await import('../audio/music/notation.ts');
  const out: [string, number][] = [];
  const base = { title: 'bench', mood: '', bpm: 120, space: { size: 0.2 } } as const;
  const silent = { ...base, tracks: [{ inst: 'sub', part: 'r:16', rev: 0 }] };
  await renderOffline(OfflineAudioContext, silent, s, 44100);
  let t0 = performance.now();
  await renderOffline(OfflineAudioContext, silent, s, 44100);
  const floor = performance.now() - t0;
  out.push(['(空白)', floor / (s * 10)]);
  for (const name of names.length ? names : Object.keys(INSTRUMENTS)) {
    const sustained = /Pad|strings|strPad|choir|chant|organ|accordion|drone|glass|menChoir/.test(name);
    const part = sustained ? pad(prog('C | Am | F | G')) : mel('C5:4 D5 E5 G5 | A5 G5 E5 D5 | C5 E5 G5 C6 | B5 G5 D5 G4');
    const def = { ...base, tracks: [{ inst: name, part, rev: 0 }] };
    await renderOffline(OfflineAudioContext, def, 1, 44100);
    t0 = performance.now();
    await renderOffline(OfflineAudioContext, def, s, 44100);
    out.push([name, (performance.now() - t0 - floor) / (s * 10)]);
  }
  return out;
};
