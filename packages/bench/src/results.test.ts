import { describe, expect, it } from 'vitest';
import { median, renderMarkdownTable, summarise } from './results';
import type { BenchmarkReport, RunSample } from './results';

function sample(overrides: Partial<RunSample>): RunSample {
  return {
    rate: 100, repeat: 0, elapsedMs: 6000,
    instrumentRowRenders: 600, positionRowRenders: 60, rendersPerQuote: 1,
    fps: 60, longTaskCount: 0, longTaskMs: 0, heapBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

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

describe('summarise', () => {
  it('ignores samples taken at other rates', () => {
    const result = {
      name: 'x',
      samples: [
        sample({ rate: 10, rendersPerQuote: 99 }),
        sample({ rate: 100, rendersPerQuote: 2 }),
      ],
    };
    expect(summarise(result, 100).rendersPerQuote).toBe(2);
  });

  it('takes the median across repeats, so one slow run cannot dominate', () => {
    const result = {
      name: 'x',
      samples: [
        sample({ repeat: 0, longTaskMs: 10 }),
        sample({ repeat: 1, longTaskMs: 12 }),
        sample({ repeat: 2, longTaskMs: 900 }),
      ],
    };
    expect(summarise(result, 100).longTaskMs).toBe(12);
  });

  it('converts heap bytes to megabytes', () => {
    const result = { name: 'x', samples: [sample({ heapBytes: 20 * 1024 * 1024 })] };
    expect(summarise(result, 100).heapMb).toBe(20);
  });
});

describe('renderMarkdownTable', () => {
  const report: BenchmarkReport = {
    soakMs: 6000,
    repeats: 1,
    results: [
      { name: 'slow', samples: [sample({ rendersPerQuote: 50 })] },
      { name: 'fast', samples: [sample({ rendersPerQuote: 1 })] },
    ],
  };

  it('orders implementations by renders per quote, best first', () => {
    const lines = renderMarkdownTable(report, 100).split('\n');
    expect(lines[2]).toContain('fast');
    expect(lines[3]).toContain('slow');
  });

  it('emits a well-formed markdown table', () => {
    const lines = renderMarkdownTable(report, 100).split('\n');
    expect(lines[0]?.startsWith('|')).toBe(true);
    expect(lines[1]).toContain('---');
  });
});
