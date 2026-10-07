// Save: all progress is stored in localStorage (the game still runs in memory when reading or writing fails); once cloud save is enabled, cloud.ts syncs it to the server.

import { getSpirit, stageForLevel } from '../data.ts';
import type { ArtId, SpiritInstance } from '../engine/types.ts';
import { defaultLoadout, sanitizeLoadout } from './loadout.ts';

export interface Inventory {
  gold: number;
  crystals: number;
  tickets: number;
  breakStones: number;
  shards: number;
  potions: number;
  stardust: number;
  stones: { basic: number; advanced: number; master: number };
}

export interface SaveData {
  version: 1;
  createdAt: number;
  /** Time of the last save (ms); cloud sync uses it to judge which copy is newer */
  updatedAt: number;
  playerName: string;
  path: 'sword' | 'magic';
  art: ArtId;
  /** Starter partner: for a new save after the pact it is the Dragon of the First Pact (eldarin); for an old save it is the one picked from three back then (the rival's partner is decided by it). An empty string means no pact yet */
  starter: string;
  spirits: SpiritInstance[];
  party: string[];
  inv: Inventory;
  cleared: Record<string, number>;
  seenStory: string[];
  /** pick: the SSR chosen as UP (when never chosen, a default is given by main story progress) */
  pity: { count: number; guaranteed: boolean; sr: number; pick?: string };
  dex: Record<string, 'seen' | 'owned'>;
  arena: { best: number };
  settings: { speed: number; sfx: number; music: number; lowfx: boolean; auto: boolean; quality: 'auto' | 'high' | 'low' };
  ending: boolean;
  uidSeq: number;
  /** Action counters for quests */
  stats: { captures: number; explores: number; pulls: number; breakthroughs: number; wins: number };
  /** Claimed quests */
  claimed: string[];
  /** Field treasure chests already opened (region id:number) */
  chests: string[];
  /** Which step of the new-player guide it has reached; no such field means it is complete. After a refresh, "Continue Adventure" resumes from here */
  tutorial?: 'battle' | 'summon';
}

const KEY = 'eldor-save-v1';

export function newSave(): SaveData {
  return {
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    playerName: '締約者',
    path: 'sword',
    art: 'oath_break',
    starter: '',
    spirits: [],
    party: [],
    inv: { gold: 1000, crystals: 0, tickets: 0, breakStones: 0, shards: 0, potions: 2, stardust: 0, stones: { basic: 5, advanced: 0, master: 0 } },
    cleared: {},
    seenStory: [],
    pity: { count: 0, guaranteed: false, sr: 0 },
    dex: {},
    arena: { best: 0 },
    settings: { speed: 1, sfx: 0.9, music: 0.5, lowfx: false, auto: false, quality: 'auto' },
    ending: false,
    uidSeq: 1,
    stats: { captures: 0, explores: 0, pulls: 0, breakthroughs: 0, wins: 0 },
    claimed: [],
    chests: [],
  };
}

/** Save keys from before rank-up was renamed "Breakthrough": breakthrough stones were originally inv.evoStones, the breakthrough count was originally stats.evolutions, and the quest breakthrough1 was originally evolve1 */
const LEGACY_QUEST_IDS: Record<string, string> = { evolve1: 'breakthrough1' };

/** Fill in fields missing from old-version saves (both local and cloud loads pass through here) */
export function normalizeSave(d: SaveData): SaveData {
  const base = newSave();
  // The skill table gets revised: remove skills that were deleted or not yet learned, and refill the skill bar if necessary
  for (const s of d.spirits ?? []) sanitizeLoadout(s);
  // After moving old keys to new keys, remove them (when both exist, the new key wins)
  const { evoStones, ...inv } = (d.inv ?? {}) as Partial<Inventory> & { evoStones?: number };
  const { evolutions, ...stats } = (d.stats ?? {}) as Partial<SaveData['stats']> & { evolutions?: number };
  const claimed = (d.claimed ?? base.claimed).map((id) => LEGACY_QUEST_IDS[id] ?? id);
  return {
    ...base,
    ...d,
    updatedAt: d.updatedAt ?? d.createdAt ?? Date.now(),
    inv: { ...base.inv, ...(evoStones !== undefined ? { breakStones: evoStones } : {}), ...inv, stones: { ...base.inv.stones, ...inv.stones } },
    settings: { ...base.settings, ...d.settings },
    stats: { ...base.stats, ...(evolutions !== undefined ? { breakthroughs: evolutions } : {}), ...stats },
    claimed: [...new Set(claimed)],
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (d.version !== 1) return null;
    return normalizeSave(d);
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData): void {
  d.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* Private mode and the like: kept in memory only */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function makeSpirit(d: SaveData, speciesId: string, level: number): SpiritInstance {
  const uid = `s${d.uidSeq++}`;
  return {
    uid,
    speciesId,
    level,
    exp: 0,
    stage: stageForLevel(level),
    resonance: 0,
    loadout: defaultLoadout(speciesId, level),
    bond: 0,
  };
}

/** Add a new spirit; if the same species is already owned, resonance goes up (when full, it converts to stardust). Returns 'new' | 'resonance' | 'stardust' */
export function addSpirit(d: SaveData, speciesId: string, level: number, allowDuplicate = false): { kind: 'new' | 'resonance' | 'stardust'; spirit: SpiritInstance } {
  const existing = d.spirits.find((s) => s.speciesId === speciesId);
  if (existing && !allowDuplicate) {
    if (existing.resonance < 5) {
      existing.resonance++;
      return { kind: 'resonance', spirit: existing };
    }
    const r = getSpirit(speciesId).rarity;
    d.inv.stardust += r === 'SSR' ? 40 : r === 'SR' ? 10 : 2;
    return { kind: 'stardust', spirit: existing };
  }
  const s = makeSpirit(d, speciesId, level);
  d.spirits.push(s);
  d.dex[speciesId] = 'owned';
  if (d.party.length < 3) d.party.push(s.uid);
  return { kind: 'new', spirit: s };
}

export function partySpirits(d: SaveData): SpiritInstance[] {
  return d.party.map((u) => d.spirits.find((s) => s.uid === u)).filter((s): s is SpiritInstance => !!s);
}

export function markSeen(d: SaveData, speciesId: string): void {
  if (!d.dex[speciesId]) d.dex[speciesId] = 'seen';
}

export function highestLevel(d: SaveData): number {
  return d.spirits.reduce((m, s) => Math.max(m, s.level), 1);
}
