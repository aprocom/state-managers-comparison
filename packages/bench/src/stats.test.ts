import { describe, expect, it } from 'vitest';
import {
  bootstrapMedianCi, cliffsDelta, formatWithCi, mannWhitney, median, percentile,
  exactUDistribution, holmAdjust,
} from './stats';

describe('percentile', () => {
  it('returns an actual observation, not an interpolation', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
  });

  it('clamps rather than reading past the ends', () => {
    expect(percentile([4], 99)).toBe(4);
    expect(percentile([4], 1)).toBe(4);
    expect(percentile([], 50)).toBe(0);
  });
});

describe('bootstrapMedianCi', () => {
  it('brackets the sample median', () => {
    const values = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const ci = bootstrapMedianCi(values);
    expect(ci.low).toBeLessThanOrEqual(median(values));
    expect(ci.high).toBeGreaterThanOrEqual(median(values));
  });

  it('is narrower for a tight sample than a spread one', () => {
    const tight = bootstrapMedianCi([50, 50, 50, 51, 50, 50, 49, 50]);
    const spread = bootstrapMedianCi([10, 90, 50, 20, 80, 45, 55, 5]);
    expect(ci(tight)).toBeLessThan(ci(spread));
  });

  it('is reproducible — the same input gives the same interval', () => {
    const values = [3, 1, 4, 1, 5, 9, 2, 6];
    expect(bootstrapMedianCi(values)).toEqual(bootstrapMedianCi(values));
  });

  it('degenerates gracefully', () => {
    expect(bootstrapMedianCi([])).toEqual({ low: 0, high: 0 });
    expect(bootstrapMedianCi([7])).toEqual({ low: 7, high: 7 });
  });
});

function ci(interval: { low: number; high: number }): number {
  return interval.high - interval.low;
}

describe('cliffsDelta', () => {
  it('is 1 when every a exceeds every b', () => {
    expect(cliffsDelta([10, 11, 12], [1, 2, 3])).toBe(1);
  });

  it('is -1 in the opposite case', () => {
    expect(cliffsDelta([1, 2, 3], [10, 11, 12])).toBe(-1);
  });

  it('is 0 for identical samples', () => {
    expect(cliffsDelta([1, 2, 3], [1, 2, 3])).toBe(0);
  });
});

describe('mannWhitney', () => {
  it('finds no significant difference between identical samples', () => {
    const a = [10, 11, 12, 13, 14, 15, 16, 17];
    expect(mannWhitney(a, [...a]).p).toBeGreaterThan(0.05);
    expect(mannWhitney(a, [...a]).magnitude).toBe('negligible');
  });

  it('finds a significant difference between clearly separated samples', () => {
    const slow = [100, 101, 102, 103, 104, 105, 106, 107];
    const fast = [10, 11, 12, 13, 14, 15, 16, 17];
    const result = mannWhitney(slow, fast);
    expect(result.p).toBeLessThan(0.05);
    expect(result.magnitude).toBe('large');
    expect(result.delta).toBe(1);
  });

  it('does not call a small overlap-heavy difference significant', () => {
    const a = [10, 12, 11, 13, 12, 11, 14, 10];
    const b = [11, 13, 12, 12, 13, 10, 15, 11];
    expect(mannWhitney(a, b).p).toBeGreaterThan(0.05);
  });

  it('survives an all-ties sample without dividing by zero', () => {
    const result = mannWhitney([5, 5, 5, 5], [5, 5, 5, 5]);
    expect(result.p).toBe(1);
    expect(Number.isNaN(result.p)).toBe(false);
  });

  it('returns p = 1 rather than NaN for an empty sample', () => {
    expect(mannWhitney([], [1, 2, 3]).p).toBe(1);
  });
});

describe('formatWithCi', () => {
  it('prints the median and its interval', () => {
    expect(formatWithCi(12.34, { low: 11.1, high: 13.9 })).toBe('12.3 [11.1–13.9]');
  });
});

describe('exactUDistribution', () => {
  it('sums to 1', () => {
    const pmf = exactUDistribution(5, 5);
    expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('has C(10,5) = 252 equally weighted arrangements at n=5, so the extreme U has mass 1/252', () => {
    const pmf = exactUDistribution(5, 5);
    expect(pmf[0]).toBeCloseTo(1 / 252, 12);
    expect(pmf[25]).toBeCloseTo(1 / 252, 12);
  });

  it('is symmetric about the mean', () => {
    const pmf = exactUDistribution(4, 6);
    for (let u = 0; u <= 24; u += 1) expect(pmf[u]).toBeCloseTo(pmf[24 - u]!, 12);
  });

  it('matches the known mode for a small case', () => {
    // n1=2, n2=2: U counts are 1,1,2,1,1 over 6 arrangements.
    const pmf = exactUDistribution(2, 2);
    expect(pmf.map((v) => Math.round(v * 6))).toEqual([1, 1, 2, 1, 1]);
  });
});

describe('mannWhitney — exact branch', () => {
  it('reports the exact floor of 2/252 for fully separated samples of five', () => {
    const result = mannWhitney([10, 11, 12, 13, 14], [20, 21, 22, 23, 24]);
    expect(result.method).toBe('exact');
    expect(result.p).toBeCloseTo(2 / 252, 10);
  });

  it('goes below the normal approximation floor of 0.0122', () => {
    expect(mannWhitney([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]).p).toBeLessThan(0.0122);
  });

  it('falls back to the normal approximation when there are ties', () => {
    expect(mannWhitney([1, 2, 2, 4, 5], [6, 7, 8, 9, 10]).method).toBe('normal');
  });
});

describe('holmAdjust', () => {
  it('leaves a single p-value alone', () => {
    expect(holmAdjust([0.01])).toEqual([0.01]);
  });

  it('multiplies the smallest by the family size', () => {
    expect(holmAdjust([0.01, 0.5, 0.5])[0]).toBeCloseTo(0.03, 10);
  });

  it('is monotone — an adjusted value never drops below a smaller one', () => {
    const adjusted = holmAdjust([0.001, 0.04, 0.04, 0.9]);
    const sorted = [...adjusted].sort((a, b) => a - b);
    expect(adjusted.slice().sort((a, b) => a - b)).toEqual(sorted);
    expect(Math.max(...adjusted)).toBeLessThanOrEqual(1);
  });

  it('caps at 1 rather than exceeding it', () => {
    expect(holmAdjust([0.6, 0.7, 0.8]).every((p) => p <= 1)).toBe(true);
  });
});
