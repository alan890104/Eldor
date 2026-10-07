// Game-feel parameters: the battle engine only outputs "what happened" (damage, crit, knockout);
// the presentation layer uses this table to decide hit-stop, screen shake, slow motion, number size, vibration and music ducking.
// See docs/07-game-feel.md.

export type HitTier = 'light' | 'medium' | 'heavy' | 'crit' | 'ko' | 'ultimate';

export interface HitFeel {
  /** Hit-stop: how many milliseconds both sides' animations freeze at the moment of impact */
  hitStopMs: number;
  /** Camera trauma 0-1; actual shake amplitude = trauma² × max offset, decaying exponentially */
  trauma: number;
  /** Slow-motion scale and duration (1 = no slowdown) */
  timeScale: number;
  timeScaleMs: number;
  /** Relative size of the damage number */
  numberScale: number;
  /** Mobile vibration pattern (Vibration API format: vibrate, pause, vibrate...) */
  vibrate: number[];
  /** Instant background-music ducking (dB, negative) */
  musicDuckDb: number;
}

export const HIT_FEEL: Record<HitTier, HitFeel> = {
  light: { hitStopMs: 40, trauma: 0, timeScale: 1, timeScaleMs: 0, numberScale: 1, vibrate: [10], musicDuckDb: 0 },
  medium: { hitStopMs: 70, trauma: 0.25, timeScale: 1, timeScaleMs: 0, numberScale: 1.15, vibrate: [20], musicDuckDb: -2 },
  heavy: { hitStopMs: 110, trauma: 0.45, timeScale: 1, timeScaleMs: 0, numberScale: 1.35, vibrate: [35], musicDuckDb: -4 },
  crit: { hitStopMs: 140, trauma: 0.6, timeScale: 0.35, timeScaleMs: 180, numberScale: 1.6, vibrate: [15, 30, 40], musicDuckDb: -6 },
  ko: { hitStopMs: 180, trauma: 0.75, timeScale: 0.25, timeScaleMs: 450, numberScale: 1.6, vibrate: [40, 40, 80], musicDuckDb: -9 },
  ultimate: { hitStopMs: 160, trauma: 0.9, timeScale: 0.3, timeScaleMs: 300, numberScale: 1.8, vibrate: [30, 30, 30, 30, 120], musicDuckDb: -8 },
};

/** Tier by damage as a fraction of the target's max HP */
export const TIER_THRESHOLD = { medium: 0.15, heavy: 0.35 } as const;

export interface HitEvent {
  /** This hit's damage ÷ the target's max HP */
  damageRatio: number;
  crit?: boolean;
  ko?: boolean;
  ultimate?: boolean;
}

/** Priority: knockout > ultimate > crit > by damage ratio */
export function hitTier(e: HitEvent): HitTier {
  if (e.ko) return 'ko';
  if (e.ultimate) return 'ultimate';
  if (e.crit) return 'crit';
  if (e.damageRatio >= TIER_THRESHOLD.heavy) return 'heavy';
  if (e.damageRatio >= TIER_THRESHOLD.medium) return 'medium';
  return 'light';
}

/** Multi-hit: for the nth hit (1-based) of one skill, hit-stop decreases; the last hit returns to the full tier */
export function multiHitStopMs(tier: HitTier, hitIndex: number, totalHits: number): number {
  const full = HIT_FEEL[tier].hitStopMs;
  if (hitIndex >= totalHits) return full;
  return Math.max(20, Math.round(full * 0.5 ** hitIndex));
}
