// Star Gate summon: uses the probabilities from the design document (sim/gacha.ts); the pity counter lives in the save.

import { SPIRITS, getSpirit } from '../data.ts';
import { LIMITED_BANNER, longRunRates, ssrRateAt, type LongRunRates } from '../../sim/gacha.ts';
import type { Rarity } from '../../sim/types.ts';
import { addSpirit, highestLevel, type SaveData } from './save.ts';

export const PULL_COST = 150;

export interface PullResult {
  speciesId: string;
  rarity: Rarity;
  kind: 'new' | 'resonance' | 'stardust';
  featured: boolean;
}

export type BannerId = 'standard' | 'up';

const pool = (r: Rarity) => SPIRITS.filter((s) => s.rarity === r).map((s) => s.id);

/** Banner contents (both banners are the same: all SSR, SR, R; N only appears in the field) */
export function poolOf(r: Rarity): string[] {
  return pool(r);
}

/**
 * Pick your UP: choose any one of the 12 SSRs. When never chosen, defaults to the next holy spirit to challenge (the first holy spirit once the main story is finished).
 * Pity follows the "current choice": after losing the 50/50, switch the pick and the next SSR is the newly picked one.
 */
export function featuredFor(d: SaveData): string {
  const pick = d.pity.pick;
  if (pick && pool('SSR').includes(pick)) return pick;
  const order = ['sylvaron', 'thalassene', 'ignisar', 'aeroth', 'terragon', 'voltarion', 'luminael', 'noxfang'];
  const idx = ['f5', 'i5', 'v5', 'h5', 'c5', 'p5', 'l5', 'd5'].findIndex((id) => !d.cleared[id]);
  return order[Math.max(0, idx)];
}

export function setFeatured(d: SaveData, speciesId: string): boolean {
  if (!pool('SSR').includes(speciesId)) return false;
  d.pity.pick = speciesId;
  return true;
}

/**
 * Long-run single-pull probability of each spirit (for the odds disclosure). UP banner: when an SSR is pulled, featuredShare is UP;
 * after losing the 50/50 (another SSR is pulled) the next one is guaranteed UP; in steady state the share of UP among SSRs = 1 / (1 + the probability of losing).
 */
export function spiritRates(banner: BannerId, featured: string): { id: string; rarity: Rarity; rate: number }[] {
  const lr = longRunSummary();
  const ssr = pool('SSR');
  const sr = pool('SR');
  const r = pool('R');
  const rRate = 1 - lr.ssr - lr.sr;
  const out: { id: string; rarity: Rarity; rate: number }[] = [];
  if (banner === 'up') {
    const s = LIMITED_BANNER.featuredShare;
    const miss = ((1 - s) * (ssr.length - 1)) / ssr.length;
    const f = 1 / (1 + miss);
    out.push({ id: featured, rarity: 'SSR', rate: lr.ssr * f });
    for (const id of ssr) if (id !== featured) out.push({ id, rarity: 'SSR', rate: (lr.ssr * (1 - f)) / (ssr.length - 1) });
  } else {
    for (const id of ssr) out.push({ id, rarity: 'SSR', rate: lr.ssr / ssr.length });
  }
  for (const id of sr) out.push({ id, rarity: 'SR', rate: lr.sr / sr.length });
  for (const id of r) out.push({ id, rarity: 'R', rate: rRate / r.length });
  return out;
}

/** How many pulls remain until the SSR pity (that pull is a guaranteed SSR); an old save's pity counter may exceed the new pity, so it returns at least 1 */
export function pityLeft(d: SaveData): number {
  return Math.max(1, LIMITED_BANNER.hardPity - d.pity.count);
}

let longRun: LongRunRates | null = null;
/** Combined drop rate including pity (for the odds explanation; the calculation takes tens of milliseconds, so it is only done the first time it is needed) */
export function longRunSummary(): LongRunRates {
  return (longRun ??= longRunRates(LIMITED_BANNER));
}

/** Level of a new spirit when it joins: about the team's highest level − 3, so a pulled spirit is useful right away */
export function joinLevel(d: SaveData): number {
  return Math.max(5, highestLevel(d) - 3);
}

export function pull(d: SaveData, banner: BannerId, n: number, rng: () => number = Math.random): PullResult[] {
  d.stats.pulls += n;
  const out: PullResult[] = [];
  const cfg = LIMITED_BANNER;
  const featured = featuredFor(d);
  for (let i = 0; i < n; i++) {
    d.pity.count++;
    d.pity.sr++;
    const pSsr = ssrRateAt(d.pity.count, cfg);
    const r = rng();
    let rarity: Rarity;
    if (r < pSsr) rarity = 'SSR';
    else if (d.pity.sr >= cfg.srPity || r < pSsr + cfg.srBase) rarity = 'SR';
    else rarity = 'R';
    let id: string;
    let isFeatured = false;
    if (rarity === 'SSR') {
      d.pity.count = 0;
      d.pity.sr = 0;
      if (banner === 'up' && (d.pity.guaranteed || rng() < cfg.featuredShare)) {
        id = featured;
        isFeatured = true;
        d.pity.guaranteed = false;
      } else {
        const list = pool('SSR');
        id = list[Math.floor(rng() * list.length)];
        if (banner === 'up') {
          if (id === featured) isFeatured = true;
          else d.pity.guaranteed = true;
        }
      }
    } else {
      if (rarity === 'SR') d.pity.sr = 0;
      const list = pool(rarity);
      id = list[Math.floor(rng() * list.length)];
    }
    const res = addSpirit(d, id, joinLevel(d));
    out.push({ speciesId: id, rarity: getSpirit(id).rarity, kind: res.kind, featured: isFeatured });
  }
  return out;
}

export interface PullCost {
  tickets: number;
  crystals: number;
  /** The holdings are enough to pay */
  ok: boolean;
}

/** Cost of n summons: summon tickets first, and the pulls beyond the tickets are made up with starlight stones (PULL_COST each) */
export function pullCost(d: SaveData, n: number): PullCost {
  const tickets = Math.min(d.inv.tickets, n);
  const crystals = (n - tickets) * PULL_COST;
  return { tickets, crystals, ok: d.inv.crystals >= crystals };
}

/** With the current summon tickets and starlight stones, how many summons in total are possible */
export function pullsAvailable(d: SaveData): number {
  return d.inv.tickets + Math.floor(d.inv.crystals / PULL_COST);
}

export function pay(d: SaveData, n: number): boolean {
  const c = pullCost(d, n);
  if (!c.ok) return false;
  d.inv.tickets -= c.tickets;
  d.inv.crystals -= c.crystals;
  return true;
}
