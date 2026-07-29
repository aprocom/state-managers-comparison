export interface RunSample {
  rate: number;
  repeat: number;
  elapsedMs: number;
  instrumentRowRenders: number;
  positionRowRenders: number;
  /** Row renders divided by quotes delivered. 1.0 means one row per quote. */
  rendersPerQuote: number;
  fps: number;
  longTaskCount: number;
  longTaskMs: number;
  heapBytes: number;
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

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export interface RateSummary {
  rate: number;
  rendersPerQuote: number;
  fps: number;
  longTaskMs: number;
  heapMb: number;
}

/**
 * Median across repeats, never mean: one slow run caused by unrelated machine
 * load would drag a mean and misreport an implementation as slower than it is.
 */
export function summarise(result: BenchmarkResult, rate: number): RateSummary {
  const samples = result.samples.filter((sample) => sample.rate === rate);
  return {
    rate,
    rendersPerQuote: median(samples.map((sample) => sample.rendersPerQuote)),
    fps: median(samples.map((sample) => sample.fps)),
    longTaskMs: median(samples.map((sample) => sample.longTaskMs)),
    heapMb: median(samples.map((sample) => sample.heapBytes)) / (1024 * 1024),
  };
}

export function renderMarkdownTable(report: BenchmarkReport, rate: number): string {
  const rows = report.results
    .map((result) => ({ name: result.name, summary: summarise(result, rate) }))
    .sort((a, b) => a.summary.rendersPerQuote - b.summary.rendersPerQuote);

  const header = '| | Row renders per quote | FPS | Long-task ms | Heap (MB) |\n'
    + '|---|---:|---:|---:|---:|';
  const body = rows
    .map(({ name, summary }) => `| **${name}** | ${summary.rendersPerQuote.toFixed(2)} `
      + `| ${summary.fps.toFixed(0)} | ${summary.longTaskMs.toFixed(0)} `
      + `| ${summary.heapMb.toFixed(1)} |`)
    .join('\n');

  return `${header}\n${body}`;
}
