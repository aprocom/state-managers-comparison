import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { TESTID } from '@smc/ui';
import { APP_TARGETS } from '@smc/bench';
import type { BenchmarkResult, RunSample } from '@smc/bench';

const SOAK_MS = 6000;
const RATES = [10, 100, 1000] as const;
const REPEATS = 3;

/**
 * Benchmarks run serially and never in parallel with each other — a parallel
 * worker stealing CPU would show up as another implementation's long tasks.
 */
test.describe.configure({ mode: 'serial' });

const results: BenchmarkResult[] = [];

for (const target of APP_TARGETS) {
  test(`${target.name} — benchmark`, async ({ page }) => {
    test.setTimeout((SOAK_MS + 8000) * RATES.length * REPEATS + 60_000);

    const samples: RunSample[] = [];

    for (const rate of RATES) {
      for (let repeat = 0; repeat < REPEATS; repeat += 1) {
        await page.goto(`http://localhost:${target.port}/`);
        await expect(page.getByTestId(TESTID.screenTerminal)).toBeVisible();

        await page.evaluate(() => {
          const w = window as unknown as {
            __SMC_LONG_TASKS__?: { count: number; totalMs: number };
            __SMC_FRAMES__?: number;
          };
          w.__SMC_LONG_TASKS__ = { count: 0, totalMs: 0 };
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              w.__SMC_LONG_TASKS__!.count += 1;
              w.__SMC_LONG_TASKS__!.totalMs += entry.duration;
            }
          }).observe({ entryTypes: ['longtask'] });

          w.__SMC_FRAMES__ = 0;
          const tick = () => {
            w.__SMC_FRAMES__! += 1;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });

        await page.getByTestId(TESTID.feedRate(rate)).click();
        // Discard the burst around the rate switch before measuring.
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          (window as unknown as { __SMC_RENDERS__?: unknown }).__SMC_RENDERS__ = {
            instrumentRow: 0, positionRow: 0, journalRow: 0,
          };
          (window as unknown as { __SMC_FRAMES__: number }).__SMC_FRAMES__ = 0;
          (window as unknown as {
            __SMC_LONG_TASKS__: { count: number; totalMs: number };
          }).__SMC_LONG_TASKS__ = { count: 0, totalMs: 0 };
        });

        const started = Date.now();
        await page.waitForTimeout(SOAK_MS);
        const elapsedMs = Date.now() - started;

        const measured = await page.evaluate(() => {
          const w = window as unknown as {
            __SMC_RENDERS__: { instrumentRow: number; positionRow: number; journalRow: number };
            __SMC_FRAMES__: number;
            __SMC_LONG_TASKS__: { count: number; totalMs: number };
          };
          const memory = (performance as unknown as {
            memory?: { usedJSHeapSize: number };
          }).memory;
          return {
            renders: w.__SMC_RENDERS__,
            frames: w.__SMC_FRAMES__,
            longTasks: w.__SMC_LONG_TASKS__,
            heapBytes: memory?.usedJSHeapSize ?? 0,
          };
        });

        samples.push({
          rate,
          repeat,
          elapsedMs,
          instrumentRowRenders: measured.renders.instrumentRow,
          positionRowRenders: measured.renders.positionRow,
          rendersPerQuote: measured.renders.instrumentRow / (rate * (elapsedMs / 1000)),
          fps: measured.frames / (elapsedMs / 1000),
          longTaskCount: measured.longTasks.count,
          longTaskMs: measured.longTasks.totalMs,
          heapBytes: measured.heapBytes,
        });
      }
    }

    results.push({ name: target.name, samples });

    // A benchmark that silently measured a broken app would be worse than no
    // benchmark at all, so assert the feed actually ran.
    const busiest = samples.filter((sample) => sample.rate === 1000);
    expect(busiest.every((sample) => sample.instrumentRowRenders > 0)).toBe(true);
  });
}

test.afterAll(() => {
  if (results.length === 0) return;
  mkdirSync('bench-results', { recursive: true });
  writeFileSync(
    'bench-results/latest.json',
    `${JSON.stringify({ soakMs: SOAK_MS, repeats: REPEATS, results }, null, 2)}\n`,
  );
});
