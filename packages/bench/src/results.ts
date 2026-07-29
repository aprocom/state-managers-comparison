import { bootstrapMedianCi, formatWithCi, mannWhitney, median } from './stats';
import type { Interval } from './stats';

/** 20 batches per second, matching BATCHES_PER_SECOND in the domain feed. */
export const BATCHES_PER_SECOND = 20;
/** The instrument table renders 50 rows. */
export const INSTRUMENT_COUNT = 50;
/** Six positions are held, all on instruments the round-robin feed visits. */
export const POSITION_COUNT = 6;

export interface RunSample {
  rate: number;
  repeat: number;
  /** CPU throttling multiplier applied via CDP. 1 is an unthrottled desktop. */
  cpuThrottle: number;

  elapsedMs: number;
  quotesDelivered: number;
  /** Quotes that landed on an instrument backing an open position. */
  heldInstrumentQuotes: number;

  instrumentRowRenders: number;
  positionRowRenders: number;
  /** Row renders divided by quotes actually delivered. 1.0 is one row per quote. */
  rendersPerQuote: number;
  positionRendersPerQuote: number;

  fps: number;
  /** Nearest-rank p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz. */
  frameP99Ms: number;
  droppedFrames: number;

  longTaskCount: number;
  longTaskMs: number;
  /** Sum of (task duration − 50 ms) over long tasks: the Lighthouse TBT definition. */
  totalBlockingMs: number;

  /**
   * Event Timing durations for real clicks made while the feed was running —
   * the primitive INP is computed from. Reported as the worst interaction,
   * which is what INP itself approximates.
   */
  interactionCount: number;
  interactionWorstMs: number;
  interactionP75Ms: number;

  scriptMsPerSecond: number;
  recalcStyleMsPerSecond: number;
  layoutMsPerSecond: number;
  taskMsPerSecond: number;
}

export interface BenchmarkResult {
  name: string;
  samples: RunSample[];
}

export interface BenchmarkReport {
  soakMs: number;
  repeats: number;
  results: BenchmarkResult[];
}

export { median } from './stats';

/**
 * The largest value `rendersPerQuote` can take at a given rate, and the reason
 * this project no longer reports that metric at 1000 updates/sec as if it were
 * a result.
 *
 * React coalesces everything one batch does into a single commit, so the worst
 * an implementation can do is re-render all 50 rows once per batch that carried
 * any quote at all. Batches that carry a quote number `min(rate, 20)` per
 * second, which makes the ceiling `50 * min(rate, 20) / rate`.
 *
 * That is 50 at 10 updates/sec, 10 at 100, and exactly 1.00 at 1000 — where the
 * batch size equals the row count and an implementation that re-renders every
 * row scores identically to one that re-renders only the row that changed. The
 * metric has real range at the two lower rates and none at the top one, which
 * is the rate the earlier version of this README leaned on hardest.
 */
export function rendersPerQuoteCeiling(rate: number): number {
  return (INSTRUMENT_COUNT * Math.min(rate, BATCHES_PER_SECOND)) / rate;
}

export type MetricKey =
  | 'scriptMsPerSecond' | 'taskMsPerSecond' | 'rendersPerQuote' | 'positionRendersPerQuote'
  | 'fps' | 'frameP99Ms' | 'droppedFrames' | 'totalBlockingMs' | 'interactionWorstMs';

export interface MetricSummary {
  metric: MetricKey;
  value: number;
  ci: Interval;
  samples: number[];
}

export function summariseMetric(
  result: BenchmarkResult,
  metric: MetricKey,
  filter: { rate: number; cpuThrottle: number },
): MetricSummary {
  const samples = result.samples
    .filter((s) => s.rate === filter.rate && s.cpuThrottle === filter.cpuThrottle)
    .map((s) => s[metric]);
  return {
    metric,
    value: median(samples),
    ci: bootstrapMedianCi(samples),
    samples,
  };
}

export interface RankedRow {
  name: string;
  summary: MetricSummary;
  /** Comparison against the best implementation on this metric. */
  vsBest: { p: number; delta: number; magnitude: string } | null;
}

/**
 * Rank implementations on one metric and test each against the best one.
 *
 * Ranking alone invites the reader to treat position as meaning. The p-value
 * and effect size next to each row say whether the ordering survived the noise,
 * and in this project's headline metric it usually does not.
 */
export function rank(
  report: BenchmarkReport,
  metric: MetricKey,
  filter: { rate: number; cpuThrottle: number },
  lowerIsBetter = true,
): RankedRow[] {
  const rows = report.results
    .map((result) => ({ name: result.name, summary: summariseMetric(result, metric, filter) }))
    .sort((a, b) => (lowerIsBetter
      ? a.summary.value - b.summary.value
      : b.summary.value - a.summary.value));

  const best = rows[0];
  return rows.map((row, index) => ({
    ...row,
    vsBest: index === 0 || best === undefined
      ? null
      : mannWhitney(row.summary.samples, best.summary.samples),
  }));
}

function formatP(p: number): string {
  if (p < 0.0001) return '<0.0001';
  if (p < 0.001) return p.toExponential(1);
  return p.toFixed(4);
}

/**
 * Render one table. `adjustedP` carries the Holm-adjusted value for each
 * non-best row, in row order, when the caller has computed it across the whole
 * family of comparisons the report makes — which it should, because a report
 * that runs a hundred tests at alpha = 0.05 expects several false positives and
 * would otherwise print them as findings. The verdict column reads from the
 * adjusted value when it is supplied.
 */
export function renderMarkdownTable(
  report: BenchmarkReport,
  metric: MetricKey,
  filter: { rate: number; cpuThrottle: number },
  { lowerIsBetter = true, digits = 1, unit = '', adjustedP = [] as number[] } = {},
): string {
  const rows = rank(report, metric, filter, lowerIsBetter);
  const hasAdjusted = adjustedP.length > 0;
  const header = `| | ${metric}${unit === '' ? '' : ` (${unit})`}, median [95% CI] `
    + `| p${hasAdjusted ? ' (Holm-adjusted)' : ''} | effect |\n|---|---:|---:|---|`;
  let comparisonIndex = 0;
  const body = rows
    .map(({ name, summary, vsBest }) => {
      const cell = formatWithCi(summary.value, summary.ci, digits);
      if (vsBest === null) return `| **${name}** | ${cell} | — | best |`;
      const adjusted = adjustedP[comparisonIndex];
      comparisonIndex += 1;
      const shown = adjusted ?? vsBest.p;
      const verdict = shown < 0.05 ? vsBest.magnitude : 'not significant';
      return `| **${name}** | ${cell} | ${formatP(shown)} | ${verdict} |`;
    })
    .join('\n');
  return `${header}\n${body}`;
}
