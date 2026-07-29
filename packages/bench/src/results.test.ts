import { describe, expect, it } from 'vitest';
import {
  median, rank, renderMarkdownTable, rendersPerQuoteCeiling, summariseMetric,
} from './results';
import type { BenchmarkReport, RunSample } from './results';

function sample(overrides: Partial<RunSample>): RunSample {
  return {
    rate: 100,
    repeat: 0,
    cpuThrottle: 1,
    elapsedMs: 6000,
    quotesDelivered: 600,
    heldInstrumentQuotes: 72,
    instrumentRowRenders: 600,
    positionRowRenders: 72,
    rendersPerQuote: 1,
    positionRendersPerQuote: 1,
    fps: 60,
    frameP99Ms: 16.7,
    droppedFrames: 0,
    longTaskCount: 0,
    longTaskMs: 0,
    totalBlockingMs: 0,
    interactionCount: 8,
    interactionWorstMs: 24,
    interactionP75Ms: 16,
    scriptMsPerSecond: 20,
    recalcStyleMsPerSecond: 2,
    layoutMsPerSecond: 9,
    taskMsPerSecond: 50,
    ...overrides,
  };
}

const AT_100 = { rate: 100, cpuThrottle: 1 };

describe('median', () => {
  it('is the middle value for an odd count', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the middle pair for an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('is 0 for no samples rather than NaN', () => {
    expect(median([])).toBe(0);
  });
});

describe('rendersPerQuoteCeiling', () => {
  it('is 50 at 10 updates/sec — the metric can see a fully broken implementation', () => {
    expect(rendersPerQuoteCeiling(10)).toBe(50);
  });

  it('is 10 at 100 updates/sec', () => {
    expect(rendersPerQuoteCeiling(100)).toBe(10);
  });

  it('is 1.00 at 1000 updates/sec — optimal and broken score the same', () => {
    expect(rendersPerQuoteCeiling(1000)).toBe(1);
  });

  it('drops below 1 above 1000, so higher rates do not restore range', () => {
    expect(rendersPerQuoteCeiling(2000)).toBeLessThan(1);
  });
});

describe('summariseMetric', () => {
  it('ignores samples taken at other rates', () => {
    const result = {
      name: 'x',
      samples: [
        sample({ rate: 10, scriptMsPerSecond: 99 }),
        sample({ rate: 100, scriptMsPerSecond: 2 }),
      ],
    };
    expect(summariseMetric(result, 'scriptMsPerSecond', AT_100).value).toBe(2);
  });

  it('ignores samples taken at another throttle level', () => {
    const result = {
      name: 'x',
      samples: [
        sample({ cpuThrottle: 4, scriptMsPerSecond: 99 }),
        sample({ cpuThrottle: 1, scriptMsPerSecond: 3 }),
      ],
    };
    expect(summariseMetric(result, 'scriptMsPerSecond', AT_100).value).toBe(3);
  });

  it('takes the median across repeats, so one slow run cannot dominate', () => {
    const result = {
      name: 'x',
      samples: [
        sample({ scriptMsPerSecond: 10 }),
        sample({ scriptMsPerSecond: 11 }),
        sample({ scriptMsPerSecond: 400 }),
      ],
    };
    expect(summariseMetric(result, 'scriptMsPerSecond', AT_100).value).toBe(11);
  });

  it('carries a confidence interval, not just a point', () => {
    const result = {
      name: 'x',
      samples: [10, 12, 11, 40, 13].map((v) => sample({ scriptMsPerSecond: v })),
    };
    const summary = summariseMetric(result, 'scriptMsPerSecond', AT_100);
    expect(summary.ci.high).toBeGreaterThan(summary.ci.low);
  });
});

function report(byName: Record<string, number[]>): BenchmarkReport {
  return {
    soakMs: 6000,
    repeats: 5,
    results: Object.entries(byName).map(([name, values]) => ({
      name,
      samples: values.map((v) => sample({ scriptMsPerSecond: v })),
    })),
  };
}

describe('rank', () => {
  it('puts the lowest median first when lower is better', () => {
    const ranked = rank(
      report({ slow: [50, 51, 52], fast: [10, 11, 12] }), 'scriptMsPerSecond', AT_100,
    );
    expect(ranked.map((r) => r.name)).toEqual(['fast', 'slow']);
  });

  it('does not test the best against itself', () => {
    const ranked = rank(report({ a: [1, 2, 3], b: [4, 5, 6] }), 'scriptMsPerSecond', AT_100);
    expect(ranked[0]?.vsBest).toBeNull();
  });

  it('flags a clearly separated implementation as significantly worse', () => {
    const ranked = rank(
      report({ fast: [10, 10, 11, 11, 12, 12], slow: [90, 91, 92, 93, 94, 95] }),
      'scriptMsPerSecond', AT_100,
    );
    expect(ranked[1]?.vsBest?.p).toBeLessThan(0.05);
    expect(ranked[1]?.vsBest?.magnitude).toBe('large');
  });

  it('does not claim significance for overlapping samples', () => {
    const ranked = rank(
      report({ a: [10, 12, 11, 13, 12, 11], b: [11, 13, 12, 12, 13, 10] }),
      'scriptMsPerSecond', AT_100,
    );
    expect(ranked[1]?.vsBest?.p).toBeGreaterThan(0.05);
  });
});

describe('renderMarkdownTable', () => {
  it('marks a non-significant runner-up as such rather than implying a win', () => {
    const table = renderMarkdownTable(
      report({ a: [10, 12, 11, 13, 12, 11], b: [11, 13, 12, 12, 13, 10] }),
      'scriptMsPerSecond', AT_100,
    );
    expect(table).toContain('not significant');
    expect(table).toContain('best');
  });

  it('prints a confidence interval for every row', () => {
    const table = renderMarkdownTable(
      report({ a: [10, 12, 11], b: [40, 42, 41] }), 'scriptMsPerSecond', AT_100,
    );
    for (const line of table.split('\n').slice(2)) {
      expect(line).toMatch(/\[\d+\.\d+–\d+\.\d+\]/);
    }
  });
});
