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
  allPairwise, pairKey, positionRendersPerQuoteCeiling, rank, renderMarkdownTable,
  rendersPerQuoteCeiling,
} from '../packages/bench/src/results.ts';
import { holmAdjust, median } from '../packages/bench/src/stats.ts';
import type {
  BenchmarkReport, MetricKey, PairwiseComparison,
} from '../packages/bench/src/results.ts';

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

// Pass one: every pairwise comparison in every cell — not only the ones the
// tables print — so the multiplicity correction covers the selection of the
// winner as well as the comparisons against it.
interface Cell {
  cpuThrottle: number;
  rate: number;
  section: Section;
  pairs: PairwiseComparison[];
}
const cells: Cell[] = [];
for (const cpuThrottle of report.cpuThrottles) {
  for (const rate of report.rates) {
    for (const section of SECTIONS) {
      cells.push({
        cpuThrottle,
        rate,
        section,
        pairs: allPairwise(report, section.metric, { rate, cpuThrottle }),
      });
    }
  }
}
const family = cells.flatMap((cell) => cell.pairs.map((pair) => pair.p));
const adjustedFamily = holmAdjust(family);
let cursor = 0;
// Adjusted p for each pair, looked up by the two implementation names.
const adjustedByCell = cells.map((cell) => {
  const lookup = new Map<string, number>();
  for (const pair of cell.pairs) {
    lookup.set(pairKey(pair.a, pair.b), adjustedFamily[cursor] ?? 1);
    cursor += 1;
  }
  return lookup;
});

/** The adjusted p for each non-best row, in the order the table prints them. */
function adjustedForTable(cell: Cell, lookup: Map<string, number>): number[] {
  const rows = rank(report, cell.section.metric, {
    rate: cell.rate, cpuThrottle: cell.cpuThrottle,
  });
  const best = rows[0];
  if (best === undefined) return [];
  return rows.slice(1).map((row) => lookup.get(pairKey(row.name, best.name)) ?? 1);
}

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
  `**The p-values are Holm-adjusted across all ${family.length} pairwise comparisons these`
  + ' samples admit** — every pair in every cell, not only the ones printed. Running this'
  + ' many tests at α = 0.05 and printing the raw values would be expected to produce'
  + ' several false positives and present them as findings. Holm controls the family-wise'
  + ' error rate without assuming the tests are independent, which they are not: the same'
  + ' samples appear in more than one comparison.'
  + ` ${survivors} of ${family.length} comparisons survive the correction.`,
  '',
  'The wider family is deliberate. The reference row in each table is whichever'
  + ' implementation came out best *in these same samples*, so the comparisons shown are'
  + ' the survivors of a selection — under a global null the winner is picked by noise and'
  + ' the gap to it is the largest gap available. Correcting only over the printed'
  + ' comparisons would ignore that selection. Correcting over all pairs covers every'
  + ' comparison the selection could have produced, which is conservative in the right'
  + ' direction.',
  '',
  "The effect column is Cliff's delta bucketed by the Romano thresholds. A row marked"
  + ' **not significant** did not survive; it should not be read as a ranking, and it is'
  + ' not evidence of equality either — with this many samples per cell, only a large'
  + ' difference can be detected at all.',
  '',
);

/**
 * How each counter responds to throttling, computed from the samples rather
 * than narrated, so the explanation cannot drift from the data under it.
 *
 * `ScriptDuration` barely moves between throttle levels and `ThreadTime`
 * multiplies. That is not a bug in either counter: Chromium emulates a slower
 * CPU by making the renderer thread spin, the spin lands outside every script
 * and task, and only the thread-time counter sees it. `npm run probe:throttle`
 * demonstrates the same thing on a page doing provably fixed work.
 */
function throttleRatioText(cpuThrottle: number): string {
  const ratio = (metric: 'scriptMsPerSecond' | 'threadMsPerSecond') => report.results
    .map((result) => {
      const at = (throttle: number) => median(result.samples
        .filter((sample) => sample.cpuThrottle === throttle)
        .map((sample) => sample[metric]));
      const unthrottled = at(1);
      return unthrottled === 0 ? Number.NaN : at(cpuThrottle) / unthrottled;
    })
    .filter((value) => Number.isFinite(value));

  const script = ratio('scriptMsPerSecond');
  const thread = ratio('threadMsPerSecond');
  if (script.length === 0) return 'Nominally a mid-range phone.';

  const span = (values: number[]) => (values.length === 0
    ? 'not recorded'
    : `${Math.min(...values).toFixed(2)}×–${Math.max(...values).toFixed(2)}×`);

  return 'Nominally a mid-range phone. **Do not compare these magnitudes with the 1×'
    + ' section**, and note that the reason is a property of the tool rather than of the'
    + ' apps. Between the two levels the same quotes are delivered, the same rows render'
    + ` and the frame rate is the same, yet scripting time moves only ${span(script)}`
    + ` while renderer thread time moves ${span(thread)}. Chromium emulates a slower CPU`
    + ' by making the renderer thread spin, and the spin sits outside every script and'
    + ' every task, so `ScriptDuration` never sees the CPU it was charged —'
    + ' `ThreadTime` does. Run `npm run probe:throttle` to watch it happen on a page'
    + ' doing fixed work. The ordering within this section is measured the same way for'
    + ' all five and is comparable; the levels are not.';
}

for (const [index, cell] of cells.entries()) {
  const previous = cells[index - 1];
  if (previous === undefined || previous.cpuThrottle !== cell.cpuThrottle) {
    lines.push(
      `## CPU throttling ${cell.cpuThrottle}×`,
      '',
      cell.cpuThrottle === 1
        ? 'An unthrottled desktop — where almost every published comparison stops.'
        : throttleRatioText(cell.cpuThrottle),
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
  if (cell.section.metric === 'rendersPerQuote' || cell.section.metric === 'positionRendersPerQuote') {
    const ceiling = cell.section.metric === 'rendersPerQuote'
      ? rendersPerQuoteCeiling(cell.rate)
      : positionRendersPerQuoteCeiling(cell.rate);
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
      adjustedP: adjustedForTable(cell, adjustedByCell[index] ?? new Map()),
    }),
    '',
  );
}

writeFileSync('bench-results/report.md', `${lines.join('\n')}\n`);
process.stdout.write(
  `Wrote bench-results/report.md — ${survivors}/${family.length} comparisons survive Holm\n`,
);
