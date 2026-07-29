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
  /** Which null distribution produced `p`. */
  method: 'exact' | 'normal';
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

/**
 * Exact null distribution of the Mann-Whitney U by dynamic programming.
 * `counts[u]` is the number of the C(n1+n2, n1) arrangements giving that U.
 *
 * This exists because the normal approximation is not valid at the sample sizes
 * this benchmark produces, and worse, it has a floor: with five samples per
 * group the smallest p it can ever report is 0.0122, so every "significant"
 * result printed exactly that number and a reader could not tell a decisive
 * separation from a marginal one. The exact floor at n=5 is 0.0079, and it
 * keeps falling as samples are added, which is the behaviour a p-value is
 * supposed to have.
 */
export function exactUDistribution(n1: number, n2: number): number[] {
  const maxU = n1 * n2;
  // w[n][m][u], built row by row. The recurrence is the classical one:
  //   w(n, m, u) = w(n-1, m, u-m) + w(n, m-1, u)
  // i.e. the last element in the ordering comes either from the first group
  // (contributing m to U) or from the second (contributing nothing).
  let previousRow: Float64Array[] = [];
  for (let n = 0; n <= n1; n += 1) {
    const row: Float64Array[] = [];
    for (let m = 0; m <= n2; m += 1) {
      const cell = new Float64Array(maxU + 1);
      if (n === 0 || m === 0) {
        cell[0] = 1;
      } else {
        const fromFirst = previousRow[m]!;
        const fromSecond = row[m - 1]!;
        for (let u = 0; u <= maxU; u += 1) {
          cell[u] = (u - m >= 0 ? fromFirst[u - m]! : 0) + fromSecond[u]!;
        }
      }
      row.push(cell);
    }
    previousRow = row;
    if (n === n1) {
      const counts = row[n2]!;
      const sum = counts.reduce((acc, value) => acc + value, 0);
      return Array.from(counts, (value) => value / sum);
    }
  }
  return [1];
}

function exactTwoSidedP(u: number, n1: number, n2: number): number {
  const pmf = exactUDistribution(n1, n2);
  const mean = (n1 * n2) / 2;
  // Two-sided: total mass at least as far from the mean as the observed U.
  const distance = Math.abs(u - mean);
  let tail = 0;
  for (let value = 0; value < pmf.length; value += 1) {
    if (Math.abs(value - mean) >= distance - 1e-9) tail += pmf[value]!;
  }
  return Math.min(1, tail);
}

export function mannWhitney(a: number[], b: number[]): ComparisonResult {
  const delta = cliffsDelta(a, b);
  const magnitude = Math.abs(delta) < 0.147 ? 'negligible'
    : Math.abs(delta) < 0.33 ? 'small'
      : Math.abs(delta) < 0.474 ? 'medium' : 'large';

  const n1 = a.length;
  const n2 = b.length;
  if (n1 === 0 || n2 === 0) return { p: 1, delta, magnitude, method: 'normal' };

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

  // Exact whenever the sample is small and untied — which is the usual case
  // here, and exactly where the normal approximation is least defensible.
  if (tieGroups.length === 0 && n1 <= 25 && n2 <= 25) {
    return { p: exactTwoSidedP(u1, n1, n2), delta, magnitude, method: 'exact' };
  }

  const variance = ((n1 * n2) / 12) * ((n + 1) - tieCorrection / (n * (n - 1)));
  if (variance <= 0) return { p: 1, delta, magnitude, method: 'normal' };

  // Continuity correction, then the two-sided normal tail.
  const z = (Math.abs(u1 - mean) - 0.5) / Math.sqrt(variance);
  const p = Math.min(1, 2 * (1 - 0.5 * (1 + erf(z / Math.SQRT2))));
  return { p, delta, magnitude, method: 'normal' };
}

/** Formats a median with its CI the way the report tables print it. */
export function formatWithCi(value: number, ci: Interval, digits = 1): string {
  return `${value.toFixed(digits)} [${ci.low.toFixed(digits)}–${ci.high.toFixed(digits)}]`;
}

/**
 * Holm-Bonferroni step-down adjustment, applied across every comparison a
 * report makes.
 *
 * Without it this project runs well over a hundred tests at alpha = 0.05 and
 * should expect several false positives by construction — and would print them
 * as findings. Holm controls the family-wise error rate without assuming the
 * tests are independent, which they are not: the same samples appear in several
 * comparisons.
 */
export function holmAdjust(pValues: number[]): number[] {
  const order = pValues
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p - b.p);
  const adjusted = new Array<number>(pValues.length);
  let running = 0;
  order.forEach(({ p, index }, rank) => {
    running = Math.max(running, Math.min(1, (pValues.length - rank) * p));
    adjusted[index] = running;
  });
  return adjusted;
}
