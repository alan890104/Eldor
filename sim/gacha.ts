// Probability model for Star Gate Summon (gacha). All numbers are computed exactly (not Monte Carlo).

export interface GachaConfig {
  /** Base SSR rate */
  ssrBase: number;
  /** From which pull since the last SSR the rate starts to rise (soft pity) */
  softPityStart: number;
  /** SSR rate added per pull during soft pity */
  softPityStep: number;
  /** Hard pity: the pull since the last SSR at which an SSR is guaranteed */
  hardPity: number;
  /** Base SR rate */
  srBase: number;
  /** At least 1 SR or better is guaranteed within every srPity pulls */
  srPity: number;
  /** Chance that an SSR is the featured (UP) spirit; after missing it, the next SSR is guaranteed to be the featured one */
  featuredShare: number;
}

export const LIMITED_BANNER: GachaConfig = {
  ssrBase: 0.015,
  softPityStart: 41,
  softPityStep: 0.08,
  hardPity: 50,
  srBase: 0.13,
  srPity: 10,
  featuredShare: 0.5,
};

/** SSR rate on the nth pull (1-based) since the last SSR */
export function ssrRateAt(n: number, cfg: GachaConfig): number {
  if (n >= cfg.hardPity) return 1;
  if (n < cfg.softPityStart) return cfg.ssrBase;
  return Math.min(1, cfg.ssrBase + cfg.softPityStep * (n - cfg.softPityStart + 1));
}

/** dist[n] = probability that the first SSR comes on exactly the nth pull (dist[0] = 0) */
export function firstSsrDistribution(cfg: GachaConfig): number[] {
  const dist = [0];
  let survive = 1;
  for (let n = 1; n <= cfg.hardPity; n++) {
    const p = ssrRateAt(n, cfg);
    dist.push(survive * p);
    survive *= 1 - p;
  }
  return dist;
}

function convolve(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0) continue;
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return out;
}

/** dist[n] = probability of getting the featured (UP) spirit on exactly the nth pull (starting from zero, no pity carried over) */
export function featuredDistribution(cfg: GachaConfig): number[] {
  const once = firstSsrDistribution(cfg);
  const twice = convolve(once, once);
  const out = new Array<number>(twice.length).fill(0);
  for (let n = 0; n < twice.length; n++) {
    out[n] = cfg.featuredShare * (once[n] ?? 0) + (1 - cfg.featuredShare) * twice[n];
  }
  return out;
}

export function mean(dist: number[]): number {
  return dist.reduce((s, p, n) => s + p * n, 0);
}

export function cdf(dist: number[], n: number): number {
  let s = 0;
  for (let i = 0; i <= n && i < dist.length; i++) s += dist[i];
  return s;
}

/** The smallest n such that the probability of success within n pulls is ≥ q */
export function quantile(dist: number[], q: number): number {
  let s = 0;
  for (let n = 0; n < dist.length; n++) {
    s += dist[n];
    if (s >= q - 1e-12) return n;
  }
  return dist.length - 1;
}

export interface LongRunRates {
  ssr: number;
  sr: number;
  r: number;
}

/**
 * Long-run combined probabilities (including soft/hard pity and SR pity).
 * State = (pulls since the last SSR, pulls since the last SR or better); iterate to convergence, then take the average drop rate.
 */
export function longRunRates(cfg: GachaConfig): LongRunRates {
  const A = cfg.hardPity;
  const B = cfg.srPity;
  let state = new Float64Array(A * B);
  state[0] = 1;
  let totals = { ssr: 0, sr: 0, r: 0 };
  const steps = 20_000;
  const warmup = 2_000;
  for (let step = 0; step < steps; step++) {
    const next = new Float64Array(A * B);
    let stepSsr = 0;
    let stepSr = 0;
    let stepR = 0;
    for (let a = 0; a < A; a++) {
      for (let b = 0; b < B; b++) {
        const w = state[a * B + b];
        if (w === 0) continue;
        const pSsr = ssrRateAt(a + 1, cfg);
        const pSr = b + 1 >= B ? 1 - pSsr : Math.min(cfg.srBase, 1 - pSsr);
        const pR = Math.max(0, 1 - pSsr - pSr);
        stepSsr += w * pSsr;
        stepSr += w * pSr;
        stepR += w * pR;
        next[0] += w * pSsr;
        if (a + 1 < A) {
          next[(a + 1) * B] += w * pSr;
          if (pR > 0) next[(a + 1) * B + (b + 1)] += w * pR;
        }
      }
    }
    if (step >= warmup) {
      totals.ssr += stepSsr;
      totals.sr += stepSr;
      totals.r += stepR;
    }
    state = next;
  }
  const n = steps - warmup;
  return { ssr: totals.ssr / n, sr: totals.sr / n, r: totals.r / n };
}
