/**
 * Turns bench-results/latest.json into the markdown the README quotes.
 *
 * It exists so the published tables are generated from the raw samples rather
 * than transcribed by hand, and so anyone can regenerate them from a run of
 * their own and see whether they get the same answer.
 *
 * Run with `npm run report`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { renderMarkdownTable, rendersPerQuoteCeiling } from '../packages/bench/src/results.ts';
import type { BenchmarkReport } from '../packages/bench/src/results.ts';

interface RawReport extends BenchmarkReport {
  rates: number[];
  cpuThrottles: number[];
  commit?: string;
  environment?: {
    platform: string; cpuModel: string; cpuCount: number; totalMemGb: number; node: string;
  };
}

const report = JSON.parse(
  readFileSync('bench-results/latest.json', 'utf8'),
) as RawReport;

const sampleCount = report.results[0]?.samples.length ?? 0;
const lines: string[] = [
  '# Benchmark results',
  '',
  `Generated from \`bench-results/latest.json\`: ${report.repeats} repeats per cell, `
  + `${(report.soakMs / 1000).toFixed(0)}-second soaks, `
  + `${sampleCount} samples per implementation, runs interleaved across implementations.`,
  '',
  'Every median carries a seeded bootstrap 95% confidence interval. The p-value is a',
  'two-sided Mann-Whitney U test against the best implementation on that metric, and',
  "the effect column is Cliff's delta bucketed by the Romano thresholds. A row marked",
  '**not significant** means the ordering above it did not survive the noise and should',
  'not be read as a ranking.',
  '',
];

if (report.commit !== undefined && report.environment !== undefined) {
  const env = report.environment;
  lines.push(
    `Commit \`${report.commit}\` · ${env.cpuModel} (${env.cpuCount} threads) · `
    + `${env.totalMemGb} GB · ${env.platform} · node ${env.node}`,
    '',
    report.commit.endsWith('-dirty')
      ? '> **The working tree was dirty when this ran.** These numbers cannot be '
        + 'traced to a commit and should be re-run before they are quoted.'
      : '',
    '',
  );
}

for (const cpuThrottle of report.cpuThrottles) {
  lines.push(
    `## CPU throttling ${cpuThrottle}×`,
    '',
    cpuThrottle === 1
      ? 'An unthrottled desktop — where almost every published comparison stops.'
      : `Approximately a mid-range phone.`,
    '',
  );

  for (const rate of report.rates) {
    lines.push(`### ${rate} updates/sec`, '');

    lines.push('**Main-thread CPU** — ms of scripting per second of wall clock.', '');
    lines.push(renderMarkdownTable(report, 'scriptMsPerSecond', { rate, cpuThrottle },
      { digits: 1, unit: 'ms/s' }), '');

    lines.push('**Interaction latency** — worst Event Timing duration for a click made while',
      'the feed was running. This is the primitive INP is computed from.', '');
    lines.push(renderMarkdownTable(report, 'interactionWorstMs', { rate, cpuThrottle },
      { digits: 0, unit: 'ms' }), '');

    lines.push('**Frame pacing** — p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz.', '');
    lines.push(renderMarkdownTable(report, 'frameP99Ms', { rate, cpuThrottle },
      { digits: 1, unit: 'ms' }), '');

    const ceiling = rendersPerQuoteCeiling(rate);
    lines.push(
      `**Instrument row renders per quote** — optimal is 1.00; the metric's ceiling at this `
      + `rate is ${ceiling.toFixed(2)}`
      + (ceiling === 1
        ? ', which is also the optimum, so this metric distinguishes nothing here.'
        : ', so a fully unmemoised implementation would be visible.'),
      '',
    );
    lines.push(renderMarkdownTable(report, 'rendersPerQuote', { rate, cpuThrottle },
      { digits: 2 }), '');

    lines.push('**Position row renders per quote that touched a held instrument** — the metric',
      'that caught MobX and Jotai deriving all six rows from one coarse computation.', '');
    lines.push(renderMarkdownTable(report, 'positionRendersPerQuote', { rate, cpuThrottle },
      { digits: 2 }), '');

    lines.push('**Total Blocking Time** — ms beyond the 50 ms long-task threshold.', '');
    lines.push(renderMarkdownTable(report, 'totalBlockingMs', { rate, cpuThrottle },
      { digits: 0, unit: 'ms' }), '');
  }
}

writeFileSync('bench-results/report.md', `${lines.join('\n')}\n`);
process.stdout.write('Wrote bench-results/report.md\n');
