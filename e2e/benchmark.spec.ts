import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';
import { INSTRUMENTS } from '@smc/domain';
import { TESTID } from '@smc/ui';
import { APP_TARGETS, percentile, rendersPerQuoteCeiling } from '@smc/bench';
import type { BenchmarkResult, RunSample } from '@smc/bench';

const SOAK_MS = 5000;
const INTERACTION_CLICKS = 8;
const RATES = [10, 100, 1000] as const;
const REPEATS = Number(process.env['BENCH_REPEATS'] ?? 5);

/**
 * 1× is an unthrottled desktop, which is where almost every published state
 * manager comparison stops and is also where nothing differs. 4× approximates
 * a mid-range phone and is where a difference in main-thread cost becomes
 * something a user could feel.
 */
const CPU_THROTTLES = (process.env['BENCH_THROTTLE'] ?? '1,4')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 1);

/**
 * Runs are serial and interleaved: the outer loop is the repeat, the inner loop
 * is the implementation. Running all of one app's samples back to back lets
 * thermal drift and background load land entirely on whichever app happened to
 * be running, and that bias is indistinguishable from a real difference.
 */
test.describe.configure({ mode: 'serial' });

const CLICK_TARGETS = INSTRUMENTS.slice(0, INTERACTION_CLICKS).map((i) => i.id);

interface Instrumentation {
  __SMC_RENDERS__: { instrumentRow: number; positionRow: number; journalRow: number };
  __SMC_QUOTES__: number;
  __SMC_FRAME_TIMES__: number[];
  __SMC_LONG_TASKS__: { count: number; totalMs: number; blockingMs: number };
  __SMC_INTERACTIONS__: number[];
  __SMC_T0__: number;
}

async function installProbes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Instrumentation;

    w.__SMC_LONG_TASKS__ = { count: 0, totalMs: 0, blockingMs: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        w.__SMC_LONG_TASKS__.count += 1;
        w.__SMC_LONG_TASKS__.totalMs += entry.duration;
        // Total Blocking Time, as Lighthouse defines it: only the part of a
        // task beyond 50 ms is time the main thread was unavailable.
        w.__SMC_LONG_TASKS__.blockingMs += Math.max(0, entry.duration - 50);
      }
    }).observe({ entryTypes: ['longtask'] });

    // Event Timing is the primitive INP is computed from. Reporting the worst
    // interaction is what INP itself approximates, and it is the metric Google
    // made a Core Web Vital that no state-manager comparison uses.
    w.__SMC_INTERACTIONS__ = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const timing = entry as PerformanceEntry & { interactionId?: number };
        if ((timing.interactionId ?? 0) > 0) w.__SMC_INTERACTIONS__.push(entry.duration);
      }
    }).observe({ type: 'event', durationThreshold: 0, buffered: true } as PerformanceObserverInit);

    // Individual frame timestamps, not a frame count. A mean FPS is capped by
    // vsync and reads 60 until things are catastrophic; the tail of the
    // inter-frame interval is where a janky implementation shows up.
    w.__SMC_FRAME_TIMES__ = [];
    const tick = (now: number) => {
      w.__SMC_FRAME_TIMES__.push(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function measure(
  page: Page, cdp: CDPSession, port: number, rate: number, repeat: number, cpuThrottle: number,
): Promise<RunSample> {
  const readMetrics = async (): Promise<Record<string, number>> => Object.fromEntries(
    (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
  );

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  await page.goto(`http://localhost:${port}/`);
  await expect(page.getByTestId(TESTID.screenTerminal)).toBeVisible();
  await installProbes(page);

  await page.getByTestId(TESTID.feedRate(rate)).click();
  // Discard the burst around the rate switch before measuring.
  await page.waitForTimeout(500);

  // Zero the counters and take t0 inside the page, so the measured window is
  // the one the page saw rather than the one bracketing two CDP round-trips.
  await page.evaluate(() => {
    const w = window as unknown as Instrumentation;
    w.__SMC_RENDERS__ = { instrumentRow: 0, positionRow: 0, journalRow: 0 };
    w.__SMC_QUOTES__ = 0;
    w.__SMC_FRAME_TIMES__ = [];
    w.__SMC_LONG_TASKS__ = { count: 0, totalMs: 0, blockingMs: 0 };
    w.__SMC_INTERACTIONS__ = [];
    w.__SMC_T0__ = performance.now();
  });
  const before = await readMetrics();

  await page.waitForTimeout(SOAK_MS);

  const after = await readMetrics();
  const throughput = await page.evaluate(() => {
    const w = window as unknown as Instrumentation;
    return {
      renders: w.__SMC_RENDERS__,
      quotes: w.__SMC_QUOTES__,
      frameTimes: w.__SMC_FRAME_TIMES__,
      longTasks: w.__SMC_LONG_TASKS__,
      elapsedMs: performance.now() - w.__SMC_T0__,
    };
  });

  // Interactions are driven after the throughput window so the clicks cannot
  // inflate the render counts they would otherwise be mixed into.
  for (const id of CLICK_TARGETS) {
    await page.getByTestId(TESTID.instrumentRow(id)).click();
    await page.waitForTimeout(120);
  }
  const interactions = await page.evaluate(
    () => (window as unknown as Instrumentation).__SMC_INTERACTIONS__,
  );

  const seconds = throughput.elapsedMs / 1000;
  const perSecond = (key: string): number => {
    const delta = (after[key] ?? 0) - (before[key] ?? 0);
    return (delta * 1000) / seconds;
  };

  const intervals: number[] = [];
  for (let i = 1; i < throughput.frameTimes.length; i += 1) {
    intervals.push(throughput.frameTimes[i]! - throughput.frameTimes[i - 1]!);
  }
  // Anything past 1.5 vsync intervals is a frame the compositor did not get.
  const droppedFrames = intervals.filter((interval) => interval > 25).length;

  const positionQuotes = throughput.quotes * (6 / 50);

  return {
    rate,
    repeat,
    cpuThrottle,
    elapsedMs: throughput.elapsedMs,
    quotesDelivered: throughput.quotes,
    instrumentRowRenders: throughput.renders.instrumentRow,
    positionRowRenders: throughput.renders.positionRow,
    rendersPerQuote: throughput.quotes === 0
      ? 0
      : throughput.renders.instrumentRow / throughput.quotes,
    positionRendersPerQuote: positionQuotes === 0
      ? 0
      : throughput.renders.positionRow / positionQuotes,
    fps: throughput.frameTimes.length / seconds,
    frameP99Ms: percentile(intervals, 99),
    droppedFrames,
    longTaskCount: throughput.longTasks.count,
    longTaskMs: throughput.longTasks.totalMs,
    totalBlockingMs: throughput.longTasks.blockingMs,
    interactionCount: interactions.length,
    interactionWorstMs: interactions.length === 0 ? 0 : Math.max(...interactions),
    interactionP75Ms: percentile(interactions, 75),
    scriptMsPerSecond: perSecond('ScriptDuration'),
    recalcStyleMsPerSecond: perSecond('RecalcStyleDuration'),
    layoutMsPerSecond: perSecond('LayoutDuration'),
    taskMsPerSecond: perSecond('TaskDuration'),
  };
}

test('benchmark — all implementations, interleaved', async ({ page }) => {
  const runs = REPEATS * RATES.length * APP_TARGETS.length * CPU_THROTTLES.length;
  test.setTimeout((SOAK_MS + INTERACTION_CLICKS * 130 + 5000) * runs + 180_000);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');

  const samplesByApp = new Map<string, RunSample[]>(
    APP_TARGETS.map((target) => [target.name, []]),
  );

  // A discarded warm-up per app: the first load pays JIT tiering and one-time
  // module evaluation that no later sample repeats. Reporting peak performance
  // without saying so is one of the standard criticisms of this genre; the
  // cold path is not what these five differ on, so it is warmed and declared.
  for (const target of APP_TARGETS) {
    await measure(page, cdp, target.port, 100, -1, 1);
  }

  for (const cpuThrottle of CPU_THROTTLES) {
    for (let repeat = 0; repeat < REPEATS; repeat += 1) {
      for (const rate of RATES) {
        for (const target of APP_TARGETS) {
          samplesByApp.get(target.name)!.push(
            await measure(page, cdp, target.port, rate, repeat, cpuThrottle),
          );
        }
      }
    }
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const results: BenchmarkResult[] = APP_TARGETS.map((target) => ({
    name: target.name,
    samples: samplesByApp.get(target.name) ?? [],
  }));

  mkdirSync('bench-results', { recursive: true });
  writeFileSync(
    'bench-results/latest.json',
    `${JSON.stringify({
      soakMs: SOAK_MS,
      repeats: REPEATS,
      rates: RATES,
      cpuThrottles: CPU_THROTTLES,
      rendersPerQuoteCeilings: Object.fromEntries(
        RATES.map((rate) => [rate, rendersPerQuoteCeiling(rate)]),
      ),
      results,
    }, null, 2)}\n`,
  );

  // A benchmark that silently measured a broken app is worse than no benchmark,
  // so assert every app actually received quotes, rendered, and was clicked.
  for (const result of results) {
    for (const cpuThrottle of CPU_THROTTLES) {
      for (const rate of RATES) {
        const atRate = result.samples.filter(
          (s) => s.rate === rate && s.cpuThrottle === cpuThrottle,
        );
        expect(atRate.length, `${result.name} @ ${rate}/${cpuThrottle}x`).toBe(REPEATS);
        expect(
          atRate.every((s) => s.quotesDelivered > 0
            && s.instrumentRowRenders > 0
            && s.interactionCount > 0),
          `${result.name} @ ${rate}/${cpuThrottle}x produced no quotes, renders or interactions`,
        ).toBe(true);
      }
    }
  }
});
