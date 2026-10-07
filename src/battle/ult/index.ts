// Ultimate cinematic selection: every SSR has its own purpose-built cinematic (ssr/<spirit id>.ts); the other rarities share a short version.
// SSR scripts are loaded on demand (preloaded when the spirit enters the battle): first, the first load does not have to carry all 12 cinematics;
// second, a broken script for one spirit only falls back to the short version and cannot take down the whole battle. The list is spelled out here (like engine/kits, no import.meta.glob).

import { getSpirit } from '../../data.ts';
import { GENERIC_ULT } from './generic.ts';
import type { UltScript } from './types.ts';

type Loader = () => Promise<{ default: UltScript }>;

const SSR_ULTS: Record<string, Loader> = {
  ignisar: () => import('./ssr/ignisar.ts'),
  thalassene: () => import('./ssr/thalassene.ts'),
  sylvaron: () => import('./ssr/sylvaron.ts'),
  aeroth: () => import('./ssr/aeroth.ts'),
  terragon: () => import('./ssr/terragon.ts'),
  voltarion: () => import('./ssr/voltarion.ts'),
  luminael: () => import('./ssr/luminael.ts'),
  noxfang: () => import('./ssr/noxfang.ts'),
  eldarin: () => import('./ssr/eldarin.ts'),
  astragate: () => import('./ssr/astragate.ts'),
  voidchild: () => import('./ssr/voidchild.ts'),
  chronodragon: () => import('./ssr/chronodragon.ts'),
};

const cache = new Map<string, Promise<UltScript>>();

export function loadUltScript(speciesId: string): Promise<UltScript> {
  const load = getSpirit(speciesId).rarity === 'SSR' ? SSR_ULTS[speciesId] : undefined;
  if (!load) return Promise.resolve(GENERIC_ULT);
  let p = cache.get(speciesId);
  if (!p) {
    p = load().then(
      (m) => m.default,
      (e) => {
        console.error(`Ultimate cutscene failed to load: ${speciesId}`, e);
        cache.delete(speciesId);
        return GENERIC_ULT;
      },
    );
    cache.set(speciesId, p);
  }
  return p;
}

export { Cine } from './cine.ts';
export type { UltCtx, UltScript } from './types.ts';
