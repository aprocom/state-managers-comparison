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
import {
  rank, renderMarkdownTable, rendersPerQuoteCeiling,
} from '../packages/bench/src/results.ts';
import { holmAdjust } from '../packages/bench/src/stats.ts';
import type { BenchmarkReport, MetricKey } from '../packages/bench/src/results.ts';

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

interface Section {
  metric: MetricKey;
  title: string;
  note: string;
  digits: number;
  unit: string;
}

const SECTIONS: Section[] = [
  {
    metric: 'scriptMsPerSecond',
    title: 'Main-thread CPU',
    note: 'Milliseconds of scripting per second of wall clock.',
    digits: 1,
    unit: 'ms/s',
  },
  {
    metric: 'interactionWorstMs',
    title: 'Interaction latency',
    note: 'Worst Event Timing duration for a click made while the feed was running — '
      + 'the primitive INP is computed from. Quantised to 8 ms by the spec.',
    digits: 0,
    unit: 'ms',
  },
  {
    metric: 'frameP99Ms',
    title: 'Frame pacing',
    note: 'p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz and is also the floor.',
    digits: 1,
    unit: 'ms',
  },
  {
    metric: 'totalBlockingMs',
    title: 'Total Blocking Time',
    note: 'Milliseconds beyond the 50 ms long-task threshold. 0 means no task ever '
      + 'reached 50 ms, not that the implementations are equal.',
    digits: 0,
    unit: 'ms',
  },
  {
    metric: 'rendersPerQuote',
    title: 'Instrument row renders per quote',
    note: '',
    digits: 2,
    unit: '',
  },
  {
    metric: 'positionRendersPerQuote',
    title: 'Position row renders per quote on a held instrument',
    note: 'Denominator measured by the feed, not assumed. This is the metric that caught '
      + 'MobX and Jotai deriving all six rows from one coarse computation.',
    digits: 2,
    unit: '',
  },
];

// Pass one: every comparison the report will make, so the multiplicity
// correction can see the whole family rather than one table at a time.
interface Cell { cpuThrottle: number; rate: number; section: Section; pValues: number[] }
const cells: Cell[] = [];
for (const cpuThrottle of report.cpuThrottles) {
  for (const rate of report.rates) {
    for (const section of SECTIONS) {
      const rows = rank(report, section.metric, { rate, cpuThrottle });
      cells.push({
        cpuThrottle,
        rate,
        section,
        pValues: rows.flatMap((row) => (row.vsBest === null ? [] : [row.vsBest.p])),
      });
    }
  }
}
const family = cells.flatMap((cell) => cell.pValues);
const adjustedFamily = holmAdjust(family);
let cursor = 0;
const adjustedByCell = cells.map((cell) => {
  const slice = adjustedFamily.slice(cursor, cursor + cell.pValues.length);
  cursor += cell.pValues.length;
  return slice;
});

const sampleCount = report.results[0]?.samples.length ?? 0;
const perCell = sampleCount === 0
  ? 0
  : sampleCount / (report.rates.length * report.cpuThrottles.length);
const survivors = adjustedFamily.filter((p) => p < 0.05).length;

const lines: string[] = [
  '# Benchmark results',
  '',
  `Generated from \`bench-results/latest.json\`: ${report.repeats} repeats per cell, `
  + `${(report.soakMs / 1000).toFixed(0)}-second soaks, `
  + `${sampleCount} samples per implementation (${perCell} per cell), `
  + 'runs interleaved across implementations, rates and CPU conditions.',
  '',
];

if (report.commit !== undefined && report.environment !== undefined) {
  const env = report.environment;
  lines.push(
    `Commit \`${report.commit}\` · ${env.cpuModel} (${env.cpuCount} threads) · `
    + `${env.totalMemGb} GB · ${env.platform} · node ${env.node}`,
    '',
  );
  if (report.commit.endsWith('-dirty')) {
    lines.push(
      '> **The working tree was dirty when this ran.** These numbers cannot be traced '
      + 'to a commit and should be re-run before they are quoted.',
      '',
    );
  }
}

lines.push(
  '## How to read these tables',
  '',
  'Each median carries a seeded bootstrap 95% confidence interval.',
  '',
  `Each implementation is compared against the best one on that metric with a two-sided`
  + ' Mann-Whitney U test — exact where the samples are untied, which they usually are, and'
  + ' the normal approximation with a tie correction otherwise.',
  '',
  `**The p-values are Holm-adjusted across all ${family.length} comparisons this report`
  + ' makes.** Running this many tests at α = 0.05 and printing the raw values would be'
  + ' expected to produce several false positives and present them as findings. Holm'
  + ' controls the family-wise error rate without assuming the tests are independent,'
  + ' which they are not — the same samples appear in more than one comparison.'
  + ` ${survivors} of ${family.length} comparisons survive the correction.`,
  '',
  "The effect column is Cliff's delta bucketed by the Romano thresholds. A row marked"
  + ' **not significant** did not survive; it should not be read as a ranking, and it is'
  + ' not evidence of equality either — with this many samples per cell, only a large'
  + ' difference can be detected at all.',
  '',
);

for (const [index, cell] of cells.entries()) {
  const previous = cells[index - 1];
  if (previous === undefined || previous.cpuThrottle !== cell.cpuThrottle) {
    lines.push(
      `## CPU throttling ${cell.cpuThrottle}×`,
      '',
      cell.cpuThrottle === 1
        ? 'An unthrottled desktop — where almost every published comparison stops.'
        : 'Nominally a mid-range phone. **Do not compare these absolute numbers with the 1×'
          + ' section.** Both conditions provably do the same work — the same quotes'
          + ' delivered, the same row renders, the same 60 FPS — and yet CDP reports'
          + ' roughly half the scripting time under throttling. Throttling cannot make the'
          + ' same work cost less, so something about how these counters are collected'
          + ' under `Emulation.setCPUThrottlingRate` is wrong, and this project has not'
          + ' worked out what. The ordering within this section is measured the same way'
          + ' for all five and is comparable; the levels are not comparable across'
          + ' sections.',
      '',
    );
  }
  if (previous === undefined
    || previous.rate !== cell.rate
    || previous.cpuThrottle !== cell.cpuThrottle) {
    lines.push(`### ${cell.rate} updates/sec`, '');
  }

  lines.push(`**${cell.section.title}**`, '');
  if (cell.section.note !== '') lines.push(cell.section.note, '');
  if (cell.section.metric === 'rendersPerQuote') {
    const ceiling = rendersPerQuoteCeiling(cell.rate);
    lines.push(
      `Optimal is 1.00. The metric's ceiling at this rate is ${ceiling.toFixed(2)}`
      + (ceiling === 1
        ? ' — which is also the optimum, so this metric distinguishes nothing here and is'
          + ' printed only to show that it cannot.'
        : ', so a fully unmemoised implementation would be plainly visible.'),
      '',
    );
  }
  lines.push(
    renderMarkdownTable(report, cell.section.metric, {
      rate: cell.rate, cpuThrottle: cell.cpuThrottle,
    }, {
      digits: cell.section.digits,
      unit: cell.section.unit,
      adjustedP: adjustedByCell[index] ?? [],
    }),
    '',
  );
}

writeFileSync('bench-results/report.md', `${lines.join('\n')}\n`);
process.stdout.write(
  `Wrote bench-results/report.md — ${survivors}/${family.length} comparisons survive Holm\n`,
);
