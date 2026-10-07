// Field exploration screen: the 3D field plus the HUD (region, target direction, minimap, interaction prompt, wild spirit nameplates, party, joystick).
// Keyboard: WASD / arrow keys move, double-tapping an arrow key or holding Shift sprints, Space jumps, E interacts, M opens the map; dragging the mouse turns the camera, the wheel zooms.
// Touch: dragging on the left half is the joystick (push it all the way, or tap twice and then push, to sprint); dragging on the right half turns the camera.
// Tapping a spot on the big map (the tower, a town, a chest, a resident or any open ground) auto-walks there; any movement of your own cancels it.

import { useEffect, useRef, useState } from 'react';
import { music } from '../../audio/music.ts';
import { battleSong } from '../../audio/music/catalog.ts';
import { sfx } from '../../audio/sfx.ts';
import { getSpirit } from '../../data.ts';
import { CORRUPT_LORE, REGIONS, towerProgress, type Line, type Reward } from '../../game/campaign.ts';
import { chestId, chestReward } from '../../game/field.ts';
import { applyReward } from '../../game/progression.ts';
import { partySpirits } from '../../game/save.ts';
import { partyLevel } from '../../game/advice.ts';
import { FieldScene, type FieldSession, type Interact, type MapMark, type NavGoal, type WildLabel } from '../../render/field/FieldScene.ts';
import { loadBiome } from '../../render/field/biomes/index.ts';
import { playerOutfit } from '../../render/field/avatar.ts';
import { fieldBattle } from '../flows.ts';
import { RewardRow } from '../items.tsx';
import { ElementChip } from '../common.tsx';
import { store, useStore } from '../store.ts';
import { Dialogue, getStage, Thumb, TopBar } from '../widgets.tsx';
import { uiZoom } from '../uiScale.ts';

/** State kept when leaving the field (battle, tower, bag), so play resumes on return */
const sessions = new Map<number, FieldSession>();
/** Back to town after a defeat */
let sendHome = -1;

const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
/** Interval within which a double tap counts (ms) */
const DOUBLE_TAP = 300;
/** Side length of the big map's canvas (CSS scales it, so clicks must be converted back) */
const BIG = 560;
/** Destination name when tapping open ground on the big map */
const SPOT = '地圖上的標記';
/** Where a spot is drawn on the map (the tower's destination is its gate, but the icon is drawn at the tower's center) */
const markPos = (sc: FieldScene, m: MapMark): [number, number] => (m.kind === 'tower' ? sc.layout.tower : [m.x, m.z]);
/**
 * Load state of the field. The overlay reads only this value, and every way the load can end (built, threw, module not found) moves it to ready or failed,
 * so the screen never sits on "Loading" while the load has actually failed. slow means the wait has gone on too long, so the player gets retry and leave buttons.
 */
type Load = { s: 'loading'; slow: boolean } | { s: 'ready' } | { s: 'failed'; why: string; stale: boolean };
/** Past this time (ms) of loading, show retry and leave */
const SLOW_MS = 10000;
/** A dynamically imported module can't be fetched (old files gone after a new build, dev server rebuilding dependencies): retrying on the same page won't help, a reload is needed */
const STALE_MODULE = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Outdated Optimize Dep/i;

export function FieldScreen({ idx }: { idx: number }) {
  const { save } = useStore();
  const region = REGIONS[idx];
  const sceneRef = useRef<FieldScene | null>(null);
  const [load, setLoad] = useState<Load>({ s: 'loading', slow: false });
  const [attempt, setAttempt] = useState(0);
  const ready = load.s === 'ready';
  const [near, setNear] = useState<Interact | null>(null);
  const [labels, setLabels] = useState<WildLabel[]>([]);
  const [dialog, setDialog] = useState<{ lines: Line[]; intro?: boolean; story?: string; after?: () => void } | null>(null);
  const [loot, setLoot] = useState<{ id: number; reward: Reward } | null>(null);
  const [encounter, setEncounter] = useState<{ name: string; level: number; corrupted: boolean } | null>(null);
  const [bigMap, setBigMap] = useState(false);
  const [hint, setHint] = useState(true);
  const [nav, setNav] = useState<NavGoal | null>(null);
  const [navMsg, setNavMsg] = useState<{ id: number; text: string } | null>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const bigRef = useRef<HTMLCanvasElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const stick = useRef<{ id: number; x: number; y: number; dx: number; dy: number; t0: number; run: boolean } | null>(null);
  /** Double-tap to sprint: the last arrow key pressed and when; cleared only once every arrow key is released */
  const lastTap = useRef({ code: '', t: 0 });
  const sprint = useRef(false);
  /** Joystick: the last touch was a tap (time of release); pressing and pushing right after it sprints */
  const stickTap = useRef(0);
  /** The spot the mouse is pointing at on the big map */
  const hover = useRef<MapMark | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const baseMap = useRef<HTMLCanvasElement | null>(null);
  const done = towerProgress(save.cleared, idx);
  const floors = region.stages.length;

  // ── Build the scene
  useEffect(() => {
    let dead = false;
    let sc: FieldScene | null = null;
    setLoad({ s: 'loading', slow: false });
    music.play(`field:${region.id}`);
    // Prepare this region's encounter track in the background so music starts at once when a wild spirit appears
    music.preload(battleSong('wild', region.id));
    const slow = window.setTimeout(() => setLoad((l) => (l.s === 'loading' ? { s: 'loading', slow: true } : l)), SLOW_MS);
    void loadBiome(region.id).then((biome) => {
      if (dead) return;
      let session = sessions.get(idx) ?? null;
      if (session && sendHome === idx) {
        const [x, z, yaw] = biome.layout.spawn;
        session = { ...session, x, z, yaw, camYaw: yaw + Math.PI, nav: undefined };
        sendHome = -1;
      }
      const d = store.save;
      const lead = partySpirits(d)[0];
      const stage = getStage();
      sc = new FieldScene(stage, {
        regionIdx: idx,
        region: region.id,
        biome,
        floors,
        floorsDone: towerProgress(d.cleared, idx),
        openedChests: biome.layout.chests.map((_, i) => d.chests.includes(chestId(region.id, i))),
        npcs: region.npcs,
        lead: lead ? { speciesId: lead.speciesId, stage: lead.stage } : null,
        outfit: playerOutfit(d.path),
        session,
        low: stage.quality === 'low',
        onEncounter: (w) => {
          const s = sceneRef.current;
          if (!s) return;
          sessions.set(idx, s.snapshot(w.key));
          const sp = getSpirit(w.spawn.speciesId);
          setEncounter({ name: sp.name, level: w.spawn.level, corrupted: w.spawn.corrupted });
          sfx.whooshBig();
          const fight = (delay: number) => {
            window.setTimeout(() => s.flashOut(), delay - 250);
            window.setTimeout(() => {
              fieldBattle(idx, w.spawn, (lost) => {
                if (lost) sendHome = idx;
                store.go({ name: 'region', idx });
              });
            }, delay);
          };
          // First meeting with a corrupted spirit: Mila explains what corrupted means first
          if (w.spawn.corrupted && !store.save.seenStory.includes('lore-corrupt')) {
            window.setTimeout(() => {
              setEncounter(null);
              setDialog({ lines: CORRUPT_LORE, story: 'lore-corrupt', after: () => fight(400) });
            }, 900);
          } else fight(900);
        },
      });
      sceneRef.current = sc;
      // For testing: with ?devsave the field can be driven from the console
      if (new URLSearchParams(location.search).has('devsave')) (window as unknown as { __field: FieldScene }).__field = sc;
      baseMap.current = sc.mapImage(256);
      setLoad({ s: 'ready' });
      if (!d.seenStory.includes(`intro-${region.id}`)) {
        sc.frozen = true;
        setDialog({ lines: region.intro, intro: true });
      }
    }).catch((e: unknown) => {
      console.error(`[field] ${region.id} failed to load`, e);
      sc?.dispose();
      sc = null;
      sceneRef.current = null;
      if (dead) return;
      const why = e instanceof Error ? e.message : String(e);
      setLoad({ s: 'failed', why, stale: STALE_MODULE.test(why) });
    }).finally(() => window.clearTimeout(slow));
    return () => {
      dead = true;
      window.clearTimeout(slow);
      sc?.dispose();
      sceneRef.current = null;
    };
  }, [idx, attempt]);

  // ── Interaction
  const interact = (it: Interact | null = sceneRef.current?.near ?? null) => {
    const sc = sceneRef.current;
    if (!sc || !it || sc.frozen) return;
    switch (it.kind) {
      case 'tower':
        sfx.confirm();
        sessions.set(idx, sc.snapshot());
        store.go({ name: 'tower', idx });
        break;
      case 'waypoint':
        sfx.confirm();
        sessions.delete(idx);
        store.go({ name: 'map' });
        break;
      case 'chest': {
        if (!sc.openChest(it.id)) return;
        sfx.fanfare();
        const n = sc.layout.chests.length;
        let got: Reward = { gold: 0 };
        store.mutate((d) => {
          got = applyReward(d, chestReward(idx, it.id, n));
          d.chests.push(chestId(region.id, it.id));
        });
        setLoot({ id: Date.now(), reward: got });
        break;
      }
      case 'npc':
        sfx.click();
        sc.greet(it.id);
        sc.frozen = true;
        setDialog({ lines: region.npcs[it.id].lines });
        break;
    }
  };
  const interactRef = useRef(interact);
  interactRef.current = interact;

  // ── Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat && e.code !== 'KeyW') {
        if (['Space', 'KeyE', 'Enter', 'KeyF'].includes(e.code)) return;
      }
      keys.current.add(e.code);
      if (MOVE_KEYS.includes(e.code) && !e.repeat) {
        // Moving yourself cancels auto-walk (without waiting for the next frame; even a light tap counts)
        sceneRef.current?.cancelNav();
        const now = performance.now();
        if (lastTap.current.code === e.code && now - lastTap.current.t < DOUBLE_TAP) sprint.current = true;
        lastTap.current = { code: e.code, t: now };
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      const sc = sceneRef.current;
      if (!sc) return;
      if (e.code === 'Space' && !sc.frozen) sc.input.jump = true;
      if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Enter') interactRef.current();
      if (e.code === 'KeyM') setBigMap((v) => !v);
      if (e.code === 'Escape') setBigMap(false);
      setHint(false);
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      if (!MOVE_KEYS.some((c) => keys.current.has(c))) sprint.current = false;
    };
    const blur = () => {
      keys.current.clear();
      sprint.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // ── Every frame: input, nameplates, prompt, minimap, target direction
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const sc = sceneRef.current;
      if (!sc) return;
      const k = keys.current;
      const on = (c: string) => (k.has(c) ? 1 : 0);
      let x = on('KeyD') + on('ArrowRight') - on('KeyA') - on('ArrowLeft');
      let z = on('KeyW') + on('ArrowUp') - on('KeyS') - on('ArrowDown');
      let run = k.has('ShiftLeft') || k.has('ShiftRight') || sprint.current;
      const st = stick.current;
      if (st) {
        const R = 56;
        const m = Math.min(1, Math.hypot(st.dx, st.dy) / R);
        if (m > 0.12) {
          const a = Math.atan2(st.dy, st.dx);
          x = Math.cos(a) * m;
          z = -Math.sin(a) * m;
          run = m > 0.92 || st.run;
        }
      }
      sc.input.x = Math.max(-1, Math.min(1, x));
      sc.input.z = Math.max(-1, Math.min(1, z));
      sc.input.run = run;
      if (now - last < 50) return;
      last = now;
      setNear((cur) => (cur?.label === sc.near?.label ? cur : sc.near));
      setLabels(sc.labels());
      setNav((cur) => (cur === sc.nav ? cur : sc.nav));
      if (sc.navEnd) {
        if (sc.navEnd === 'blocked') setNavMsg({ id: now, text: '路被擋住了，自動前往中止' });
        else sfx.click();
        sc.navEnd = null;
      }
      drawMinimap(sc, mapRef.current, baseMap.current, false, null);
      if (bigRef.current) drawMinimap(sc, bigRef.current, baseMap.current, true, hover.current);
      // Target: the direction of the Seal Tower (relative to the camera)
      const [tx, tz] = sc.layout.tower;
      const dx = tx - sc.pos.x;
      const dz = tz - sc.pos.z;
      const ang = Math.atan2(dx, dz) - (sc.camYaw + Math.PI);
      if (arrowRef.current) arrowRef.current.style.transform = `rotate(${-ang}rad)`;
      if (distRef.current) distRef.current.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Touch and mouse: joystick, camera turn, zoom
  const onDown = (e: React.PointerEvent) => {
    setHint(false);
    const touch = e.pointerType !== 'mouse';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (touch && e.clientX < window.innerWidth * 0.45 && !stick.current) {
      const now = performance.now();
      stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, t0: now, run: now - stickTap.current < DOUBLE_TAP + 80 };
      if (stickRef.current) {
        stickRef.current.style.display = 'block';
        stickRef.current.style.left = `${e.clientX}px`;
        stickRef.current.style.top = `${e.clientY}px`;
      }
      if (knobRef.current) knobRef.current.style.transform = 'translate(-50%, -50%)';
    } else if (!look.current) look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => {
    const st = stick.current;
    if (st && st.id === e.pointerId) {
      st.dx = e.clientX - st.x;
      st.dy = e.clientY - st.y;
      const m = Math.hypot(st.dx, st.dy);
      const R = 56;
      const k = m > R ? R / m : 1;
      if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${st.dx * k}px), calc(-50% + ${st.dy * k}px))`;
      return;
    }
    const lk = look.current;
    if (lk && lk.id === e.pointerId) {
      sceneRef.current?.rotateCam(e.clientX - lk.x, e.clientY - lk.y);
      lk.x = e.clientX;
      lk.y = e.clientY;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const st = stick.current;
    if (st?.id === e.pointerId) {
      // A light tap (short, barely pushed): remember it, and pressing and pushing right after it is a sprint
      stickTap.current = performance.now() - st.t0 < 250 && Math.hypot(st.dx, st.dy) < 14 ? performance.now() : 0;
      stick.current = null;
      if (stickRef.current) stickRef.current.style.display = 'none';
    }
    if (look.current?.id === e.pointerId) look.current = null;
  };
  const onWheel = (e: React.WheelEvent) => sceneRef.current?.zoomCam(e.deltaY * 0.001);

  // ── Auto-walk
  const go = (goal: NavGoal) => {
    const sc = sceneRef.current;
    if (!sc) return;
    if (sc.navigate(goal)) {
      sfx.confirm();
      setNav(sc.nav);
      setBigMap(false);
      setHint(false);
    } else {
      sfx.click();
      setNavMsg({ id: performance.now(), text: goal.label === SPOT ? '那裡走不過去' : `找不到走到${goal.label}的路` });
    }
  };
  /** A point on the big map -> world coordinates and the nearest spot */
  const mapHit = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; z: number; mark: MapMark | null } | null => {
    const sc = sceneRef.current;
    if (!sc) return null;
    const rc = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rc.left) / rc.width) * BIG;
    const pz = ((e.clientY - rc.top) / rc.height) * BIG;
    const S = sc.layout.size;
    const x = ((px - BIG / 2) / (BIG / 2)) * S;
    const z = ((pz - BIG / 2) / (BIG / 2)) * S;
    let mark: MapMark | null = null;
    let best = e.pointerType === 'mouse' ? 16 : 26;
    for (const m of sc.mapMarks()) {
      const [mx, mz] = markPos(sc, m);
      const d = Math.hypot(((mx / S) * BIG) / 2 + BIG / 2 - px, ((mz / S) * BIG) / 2 + BIG / 2 - pz);
      if (d < best) [best, mark] = [d, m];
    }
    return { x, z, mark };
  };
  const onMapMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hit = mapHit(e);
    hover.current = hit?.mark ?? null;
    e.currentTarget.style.cursor = hover.current ? 'pointer' : 'crosshair';
  };
  const onMapClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hit = mapHit(e);
    if (!hit) return;
    hover.current = null;
    go(hit.mark ?? { x: hit.x, z: hit.z, label: SPOT, arrive: 1.2 });
  };
  const stopNav = () => {
    sceneRef.current?.cancelNav();
    setNav(null);
  };

  useEffect(() => {
    if (!loot) return;
    const t = window.setTimeout(() => setLoot(null), 2600);
    return () => window.clearTimeout(t);
  }, [loot]);
  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 9000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!navMsg) return;
    const t = window.setTimeout(() => setNavMsg(null), 2400);
    return () => window.clearTimeout(t);
  }, [navMsg]);

  const party = partySpirits(save);
  const plv = partyLevel(save);
  const nextFloor = done < floors ? done + 1 : 0;
  const leave = () => {
    sessions.delete(idx);
    store.go({ name: 'map' });
  };
  const toBag = () => {
    const sc = sceneRef.current;
    if (sc) sessions.set(idx, sc.snapshot());
    store.go({ name: 'team', from: { name: 'region', idx } });
  };

  const uz = uiZoom();
  return (
    <div className="screen fld">
      <div className="fld-touch" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} />
      <TopBar title={region.name} back={leave} />
      {!ready && (
        <div className={`fld-loading ${load.s}`}>
          <b>{region.town}・{region.name}</b>
          {load.s === 'failed' && <p>這片野外沒有載入成功<small>{load.why}</small></p>}
          {load.s === 'loading' && load.slow && <p>載入比平常久，可能卡住了</p>}
          {(load.s === 'failed' || (load.s === 'loading' && load.slow)) && (
            <div className="fld-load-acts">
              {load.s === 'failed' && load.stale ? (
                <button className="btn" onClick={() => location.reload()}>重新整理</button>
              ) : (
                <button className="btn" onClick={() => setAttempt((n) => n + 1)}>再試一次</button>
              )}
              <button className="btn ghost" onClick={leave}>回到地圖</button>
            </div>
          )}
        </div>
      )}

      {/* Nameplates: scaled with the UI scale (CSS zoom), so the projected coordinates are divided by the scale first */}
      <div className="fld-labels">
        {labels.map((l) => (
          <div key={l.key} className={`fld-tag ${l.corrupted ? 'corrupt' : ''} ${l.level > plv + 2 ? 'strong' : ''}`} style={{ left: l.x / uz, top: l.y / uz, opacity: Math.min(1, (20 - l.dist) / 6) }}>
            {l.alert && <b className="fld-alert">!</b>}
            <span>{l.corrupted ? '蝕化・' : ''}{l.name}</span>
            <i>Lv {l.level}</i>
          </div>
        ))}
      </div>

      {/* Top left: region and target */}
      <div className="fld-info">
        <div className="fld-region panel">
          {region.element && <ElementChip el={region.element} />}
          <div>
            <b>{region.town}</b>
            <small className="gsep"><span>{region.name}</span><span>野生精靈 Lv {Math.max(2, region.level - 3)}～{region.level + 4}</span></small>
          </div>
        </div>
        <button
          className="fld-goal panel"
          title="點一下自動前往伏魔塔"
          onClick={() => {
            const t = sceneRef.current?.mapMarks().find((m) => m.kind === 'tower');
            if (t) go(t);
          }}
        >
          <span className="fld-arrow" ref={arrowRef}>▲</span>
          <div>
            <b>{nextFloor ? `伏魔塔・第 ${nextFloor} 層` : '伏魔塔已全部突破'}</b>
            <small className="gsep"><span>{region.tower} {done}/{floors}</span><span ref={distRef} /></small>
          </div>
        </button>
        {nav && (
          <div className="fld-nav panel">
            <span className="fld-nav-dot" />
            <div>
              <b>自動前往・{nav.label}</b>
              <small>{COARSE ? '推搖桿' : '按方向鍵'}就能取消</small>
            </div>
            <button className="btn small ghost" onClick={stopNav}>取消</button>
          </div>
        )}
      </div>
      {navMsg && <div key={navMsg.id} className="fld-navmsg panel">{navMsg.text}</div>}

      {/* Top right: minimap */}
      <button className="fld-mini" onClick={() => setBigMap(true)} title="展開地圖（M）">
        <canvas ref={mapRef} width={180} height={180} />
      </button>

      {/* Bottom left: party */}
      <div className="fld-party">
        {party.map((s) => (
          <button key={s.uid} className="fld-pm" onClick={toBag}>
            <Thumb speciesId={s.speciesId} stage={s.stage} size={46} />
            <i>Lv {s.level}</i>
          </button>
        ))}
        <button className="btn small ghost fld-bag" onClick={toBag}>背包</button>
      </div>

      {/* Interaction prompt */}
      {near && !dialog && !encounter && (
        <button className={`fld-prompt ${near.kind}`} onClick={() => interact(near)}>
          {!COARSE && <kbd>E</kbd>}
          {near.label}
        </button>
      )}
      {COARSE && ready && !dialog && (
        <button className="fld-jump" onPointerDown={(e) => { e.stopPropagation(); if (sceneRef.current && !sceneRef.current.frozen) sceneRef.current.input.jump = true; }}>跳</button>
      )}
      <div className="fld-stick" ref={stickRef}>
        <div className="fld-knob" ref={knobRef} />
      </div>
      {hint && ready && !dialog && (
        <div className="fld-hint gsep">
          {(COARSE ? ['左半邊拖曳移動（點兩下再推或推到底奔跑）', '右半邊拖曳轉動視角', '點小地圖選地點自動前往'] : ['WASD 移動', '連按兩下奔跑', '空白鍵 跳', '拖曳滑鼠轉視角', 'E 互動', 'M 地圖（點地點自動前往）']).map((t) => <span key={t}>{t}</span>)}
        </div>
      )}

      {/* Chest reward */}
      {loot && (
        <div key={loot.id} className="fld-loot panel">
          <b>打開了寶箱！</b>
          <div className="fld-loot-items">
            <RewardRow reward={loot.reward} />
          </div>
        </div>
      )}

      {/* Encounter */}
      {encounter && (
        <div className={`fld-enc ${encounter.corrupted ? 'corrupt' : ''}`}>
          <div className="fld-enc-bar">
            <small>{encounter.corrupted ? '蝕化精靈撲了過來！' : '野生精靈出現了！'}</small>
            <b>{encounter.name}</b>
            <i>Lv {encounter.level}</i>
          </div>
        </div>
      )}

      {/* Big map */}
      {bigMap && (
        <div className="fld-bigmap" onClick={() => setBigMap(false)}>
          <div className="fld-bigmap-box panel" onClick={(e) => e.stopPropagation()}>
            <div className="fld-bigmap-head">
              <b>{region.name}</b>
              <button className="btn small ghost" onClick={() => setBigMap(false)}>關閉</button>
            </div>
            <canvas
              ref={bigRef}
              width={BIG}
              height={BIG}
              onPointerMove={onMapMove}
              onPointerLeave={() => (hover.current = null)}
              onPointerUp={onMapClick}
            />
            <div className="fld-legend">
              <span><i className="lg-me" />你</span>
              <span><i className="lg-tower" />伏魔塔</span>
              <span><i className="lg-town" />城鎮／傳送陣</span>
              <span><i className="lg-chest" />寶箱</span>
              <span><i className="lg-npc" />居民</span>
              <span><i className="lg-wild" />野生精靈</span>
              <span><i className="lg-corrupt" />蝕化精靈</span>
              <span className="fld-legend-tip">點地點或空地，自動走過去</span>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <Dialogue
          lines={dialog.lines}
          onDone={() => {
            if (dialog.intro) store.mutate((d) => d.seenStory.push(`intro-${region.id}`));
            if (dialog.story) store.mutate((d) => d.seenStory.push(dialog.story!));
            setDialog(null);
            if (dialog.after) dialog.after();
            else if (sceneRef.current) sceneRef.current.frozen = false;
          }}
        />
      )}
    </div>
  );
}

/** Minimap: small is centered on the character with north up; big shows the whole map and labels the spots (hover is the spot the mouse is pointing at) */
function drawMinimap(sc: FieldScene, cv: HTMLCanvasElement | null, base: HTMLCanvasElement | null, big: boolean, hover: MapMark | null): void {
  if (!cv || !base) return;
  const g = cv.getContext('2d');
  if (!g) return;
  const W = cv.width;
  const S = sc.layout.size;
  const view = big ? S : 55;
  const cx = big ? 0 : sc.pos.x;
  const cz = big ? 0 : sc.pos.z;
  const toPx = (x: number, z: number): [number, number] => [((x - cx) / view) * (W / 2) + W / 2, ((z - cz) / view) * (W / 2) + W / 2];
  const marks = sc.mapMarks();
  const t = performance.now() / 1000;
  g.clearRect(0, 0, W, W);
  g.save();
  if (!big) {
    g.beginPath();
    g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    g.clip();
  }
  // Base map
  const bw = base.width;
  const sx = ((cx - view + S) / (2 * S)) * bw;
  const sz = ((cz - view + S) / (2 * S)) * bw;
  const sw = ((2 * view) / (2 * S)) * bw;
  g.fillStyle = '#1a1830';
  g.fillRect(0, 0, W, W);
  g.drawImage(base, sx, sz, sw, sw, 0, 0, W, W);
  // Roads
  g.strokeStyle = 'rgba(255, 240, 200, 0.55)';
  g.lineWidth = big ? 3 : 2.5;
  for (const road of sc.comp.roads) {
    g.beginPath();
    road.forEach(([x, z], i) => {
      const [px, pz] = toPx(x, z);
      if (i) g.lineTo(px, pz);
      else g.moveTo(px, pz);
    });
    g.stroke();
  }
  const r = big ? 1.4 : 1;
  // Auto-walk route: a dashed line flowing forward, with a breathing ring at the destination
  const route = sc.navRoute();
  if (route.length > 1) {
    g.save();
    g.strokeStyle = 'rgba(20, 30, 40, 0.55)';
    g.lineWidth = big ? 6 : 4.5;
    g.lineJoin = 'round';
    g.beginPath();
    route.forEach(([x, z], i) => {
      const [px, pz] = toPx(x, z);
      if (i) g.lineTo(px, pz);
      else g.moveTo(px, pz);
    });
    g.stroke();
    g.strokeStyle = '#7affd6';
    g.lineWidth = big ? 3 : 2.5;
    g.setLineDash([7 * r, 5 * r]);
    g.lineDashOffset = -t * 18;
    g.stroke();
    g.restore();
    const nv = sc.nav;
    if (nv) {
      const [ex, ez] = toPx(nv.x, nv.z);
      g.strokeStyle = '#7affd6';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(ex, ez, (7 + Math.sin(t * 4) * 2) * r, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // Wild spirits
  for (const w of sc.wildDots()) {
    if (!big && Math.hypot(w.x - sc.pos.x, w.z - sc.pos.z) > view) continue;
    const [px, pz] = toPx(w.x, w.z);
    g.fillStyle = w.corrupted ? '#c86aff' : '#ffffff';
    g.beginPath();
    g.arc(px, pz, 2.4 * r, 0, Math.PI * 2);
    g.fill();
  }
  // Residents
  for (const m of marks) {
    if (m.kind !== 'npc') continue;
    const [px, pz] = toPx(m.x, m.z);
    g.fillStyle = '#9dffb0';
    g.strokeStyle = '#1a3a22';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(px, pz, 2.8 * r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // Chests
  for (const c of sc.chestDots()) {
    if (c.open) continue;
    const [px, pz] = toPx(c.x, c.z);
    g.fillStyle = '#ffd24a';
    g.strokeStyle = '#6a4200';
    g.lineWidth = 1.5;
    g.fillRect(px - 3.5 * r, pz - 2.5 * r, 7 * r, 5 * r);
    g.strokeRect(px - 3.5 * r, pz - 2.5 * r, 7 * r, 5 * r);
  }
  // Towns and teleport pads
  const [tx, tz] = toPx(sc.layout.town[0], sc.layout.town[1]);
  g.fillStyle = 'rgba(120, 200, 255, 0.9)';
  g.beginPath();
  g.arc(tx, tz, 5 * r, 0, Math.PI * 2);
  g.fill();
  const [wx, wz] = toPx(sc.layout.waypoint[0], sc.layout.waypoint[1]);
  g.strokeStyle = '#8ad8ff';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(wx, wz, 4 * r, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  // Seal Tower: pinned to the edge when it falls outside the minimap
  let [ox, oz] = toPx(sc.layout.tower[0], sc.layout.tower[1]);
  if (!big) {
    const dx = ox - W / 2;
    const dz = oz - W / 2;
    const d = Math.hypot(dx, dz);
    const max = W / 2 - 10;
    if (d > max) {
      ox = W / 2 + (dx / d) * max;
      oz = W / 2 + (dz / d) * max;
    }
  }
  g.fillStyle = '#ffd978';
  g.strokeStyle = '#3a2400';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(ox, oz - 8 * r);
  g.lineTo(ox + 5 * r, oz + 5 * r);
  g.lineTo(ox - 5 * r, oz + 5 * r);
  g.closePath();
  g.fill();
  g.stroke();
  // Big map: spot names (residents show only when the mouse points at them, so the town doesn't get crowded) and the halo on the spot being pointed at
  if (big) {
    g.textAlign = 'center';
    g.lineJoin = 'round';
    const label = (text: string, x: number, y: number, size: number, color: string) => {
      g.font = `900 ${size}px sans-serif`;
      const w = g.measureText(text).width;
      const lx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
      const ly = Math.max(size + 2, Math.min(W - 4, y));
      g.strokeStyle = 'rgba(12, 8, 24, 0.9)';
      g.lineWidth = 4;
      g.strokeText(text, lx, ly);
      g.fillStyle = color;
      g.fillText(text, lx, ly);
    };
    for (const m of marks) {
      const [px, pz] = toPx(...markPos(sc, m));
      const on = hover !== null && hover.kind === m.kind && hover.x === m.x && hover.z === m.z;
      if (on) {
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(px, pz, 12 + Math.sin(t * 5) * 1.5, 0, Math.PI * 2);
        g.stroke();
      }
      if (m.kind === 'tower') label(m.label, px, pz - 16, on ? 17 : 16, '#ffd978');
      else if (m.kind === 'town') label(m.label, px, pz + 24, on ? 16 : 15, '#9ad8ff');
      else if (m.kind === 'waypoint') label(m.label, px, pz - 12, on ? 14 : 13, '#bfe8ff');
      else if (m.kind === 'chest') label(m.label, px, pz - 10, on ? 14 : 12, '#ffe08a');
      else if (on) label(m.label, px, pz - 10, 14, '#b8ffc6');
    }
  }
  // Yourself: an arrow facing the character's heading, plus a fan for the camera's field of view
  const [px, pz] = toPx(sc.pos.x, sc.pos.z);
  const fov = sc.camYaw + Math.PI;
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.beginPath();
  g.moveTo(px, pz);
  g.arc(px, pz, 26 * r, Math.PI / 2 - fov - 0.5, Math.PI / 2 - fov + 0.5);
  g.closePath();
  g.fill();
  g.save();
  g.translate(px, pz);
  g.rotate(-sc.yaw + Math.PI);
  g.fillStyle = '#ff5a6a';
  g.strokeStyle = '#fff';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -7 * r);
  g.lineTo(5 * r, 6 * r);
  g.lineTo(0, 3 * r);
  g.lineTo(-5 * r, 6 * r);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  if (!big) {
    g.strokeStyle = 'rgba(255, 217, 120, 0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#ffd978';
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'center';
    g.fillText('N', W / 2, 16);
  }
}
