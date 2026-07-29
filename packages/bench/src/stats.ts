import { mulberry32 } from '@smc/domain';

/**
 * The statistics a performance comparison needs in order to say anything, and
 * the part most published comparisons skip.
 *
 * A median on its own cannot answer the only question that matters — is the gap
 * between two implementations larger than the noise inside one of them? Three
 * things are provided here for that: a bootstrap confidence interval for the
 * median, a Mann-Whitney U test for the difference between two samples, and a
 * Cliff's delta effect size so a difference that is statistically real can
 * still be reported as practically negligible.
 *
 * Mann-Whitney rather than Student's t: latency and CPU-time samples are
 * bounded below, right-skewed and not normal, and a rank test does not care.
 * Cliff's delta rather than Cohen's d for the same reason.
 */

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Nearest-rank percentile: p95 of 20 samples is a real observation, not an interpolation. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1] ?? 0;
}

export interface Interval {
  low: number;
  high: number;
}

/**
 * Percentile bootstrap CI for the median. Seeded, so the published interval is
 * reproducible rather than something that shifts on every run.
 */
export function bootstrapMedianCi(
  values: number[],
  { resamples = 2000, confidence = 0.95, seed = 20260729 } = {},
): Interval {
  if (values.length === 0) return { low: 0, high: 0 };
  if (values.length === 1) return { low: values[0]!, high: values[0]! };

  const nextRandom = mulberry32(seed);
  const medians: number[] = [];
  for (let i = 0; i < resamples; i += 1) {
    const draw: number[] = [];
    for (let n = 0; n < values.length; n += 1) {
      draw.push(values[Math.floor(nextRandom() * values.length)]!);
    }
    medians.push(median(draw));
  }
  const alpha = (1 - confidence) / 2;
  return {
    low: percentile(medians, alpha * 100),
    high: percentile(medians, (1 - alpha) * 100),
  };
}

export interface ComparisonResult {
  /** Two-sided p-value from the normal approximation with a tie correction. */
  p: number;
  /** Cliff's delta in [-1, 1]: the probability a draws above b, minus the reverse. */
  delta: number;
  /** Thresholds from Romano et al.: <0.147 negligible, <0.33 small, <0.474 medium. */
  magnitude: 'negligible' | 'small' | 'medium' | 'large';
}

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26, plenty for a p-value we only threshold at 0.05.
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t
    + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

export function cliffsDelta(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let greater = 0;
  let less = 0;
  for (const x of a) {
    for (const y of b) {
      if (x > y) greater += 1;
      else if (x < y) less += 1;
    }
  }
  return (greater - less) / (a.length * b.length);
}

export function mannWhitney(a: number[], b: number[]): ComparisonResult {
  const delta = cliffsDelta(a, b);
  const magnitude = Math.abs(delta) < 0.147 ? 'negligible'
    : Math.abs(delta) < 0.33 ? 'small'
      : Math.abs(delta) < 0.474 ? 'medium' : 'large';

  const n1 = a.length;
  const n2 = b.length;
  if (n1 === 0 || n2 === 0) return { p: 1, delta, magnitude };

  // Rank the pooled sample, averaging ranks within ties.
  const pooled = [...a.map((v) => ({ v, from: 0 })), ...b.map((v) => ({ v, from: 1 }))]
    .sort((x, y) => x.v - y.v);
  const ranks = new Array<number>(pooled.length);
  const tieGroups: number[] = [];
  let i = 0;
  while (i < pooled.length) {
    let j = i;
    while (j + 1 < pooled.length && pooled[j + 1]!.v === pooled[i]!.v) j += 1;
    const averageRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) ranks[k] = averageRank;
    if (j > i) tieGroups.push(j - i + 1);
    i = j + 1;
  }

  let rankSumA = 0;
  for (let k = 0; k < pooled.length; k += 1) {
    if (pooled[k]!.from === 0) rankSumA += ranks[k]!;
  }

  const u1 = rankSumA - (n1 * (n1 + 1)) / 2;
  const mean = (n1 * n2) / 2;
  const n = n1 + n2;
  const tieCorrection = tieGroups.reduce((sum, t) => sum + (t ** 3 - t), 0);
  const variance = ((n1 * n2) / 12) * ((n + 1) - tieCorrection / (n * (n - 1)));
  if (variance <= 0) return { p: 1, delta, magnitude };

  // Continuity correction, then the two-sided normal tail.
  const z = (Math.abs(u1 - mean) - 0.5) / Math.sqrt(variance);
  const p = Math.min(1, 2 * (1 - 0.5 * (1 + erf(z / Math.SQRT2))));
  return { p, delta, magnitude };
}

/** Formats a median with its CI the way the report tables print it. */
export function formatWithCi(value: number, ci: Interval, digits = 1): string {
  return `${value.toFixed(digits)} [${ci.low.toFixed(digits)}–${ci.high.toFixed(digits)}]`;
}
