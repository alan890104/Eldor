// Pure logic of cloud saves (touches neither the network nor localStorage, to ease testing): which copy to keep, local or cloud.

import type { SaveData } from './save.ts';

/** A save on the cloud */
export interface CloudSave {
  /** +1 on every write; an upload must carry the rev it saw, and a mismatch means another device has written */
  rev: number;
  /** Client time when saved (ms) */
  updatedAt: number;
  data: SaveData;
}

export type Decision = 'useCloud' | 'pushLocal' | 'same';

/** A save with actual progress: a pact with the starter partner has been made (new saves have Eldarin, old saves the one picked from three) */
export function hasProgress(d: SaveData | null | undefined): boolean {
  return !!d && !!d.starter;
}

/**
 * Decide which copy to use at startup: the one without progress yields to the one with progress; if both have progress, compare save times and the newer wins.
 * Equal times count as the same copy and nothing changes.
 */
export function decide(local: SaveData | null, cloud: CloudSave | null): Decision {
  if (!cloud || !hasProgress(cloud.data)) return hasProgress(local) ? 'pushLocal' : 'same';
  if (!hasProgress(local)) return 'useCloud';
  const lt = local!.updatedAt ?? 0;
  const ct = cloud.updatedAt ?? 0;
  if (ct > lt) return 'useCloud';
  if (lt > ct) return 'pushLocal';
  return 'same';
}

/** When an in-play upload is rejected (409): it counts as a conflict only if the cloud copy is newer; otherwise the rev is merely stale and a retry is enough */
export function isRealConflict(local: SaveData, cloud: CloudSave | null): boolean {
  return !!cloud && hasProgress(cloud.data) && (cloud.updatedAt ?? 0) > (local.updatedAt ?? 0);
}
