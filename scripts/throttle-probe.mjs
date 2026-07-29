/**
 * What does CDP CPU throttling actually do to the counters this benchmark reads?
 *
 * The benchmark reports scripting milliseconds per second of wall clock at 1×
 * and 4× CPU throttling, and the two sections cannot be compared with each
 * other. This script is why. It loads a page that does a **fixed** amount of
 * arithmetic on a 50 ms interval and, at each throttle level, records:
 *
 *   - how many ticks ran, and how many animation frames — the work actually done
 *   - how long each tick took, measured inside the page
 *   - ScriptDuration, TaskDuration and ThreadTime, from `Performance.getMetrics`
 *
 * The result, on the machine this was developed on: the tick count and the frame
 * count are identical at both levels, `ScriptDuration` moves by around 15%, and
 * `ThreadTime` multiplies by roughly 29× — from ~130 ms to ~3.8 s of a 5-second
 * soak, which is about 76% of the thread, exactly what stealing three quarters
 * of the CPU looks like.
 *
 * That is the whole explanation. Chromium emulates a slower CPU by making the
 * renderer thread spin, and the spinning happens outside every script and every
 * task, so the script and task counters do not see it. They are not broken;
 * they are answering a different question — how long the script itself ran, not
 * how much CPU the emulated device would have needed. Comparing scripting ms/s
 * across throttle levels is therefore meaningless in either direction, and this
 * project publishes the two sections separately for that reason.
 *
 * Run with `npm run probe:throttle`. Takes about 30 seconds.
 */
import { chromium } from '@playwright/test';

const PAGE = `
<!doctype html><meta charset=utf8><title>throttle probe</title><body><div id=o></div>
<script>
window.__ticks = 0;
window.__busyWallMs = 0;
window.__rafs = 0;
function busy(n) { let x = 0; for (let i = 0; i < n; i++) x += Math.sqrt(i) * 1.000001; return x; }
setInterval(() => {
  const t0 = performance.now();
  busy(400000);
  window.__busyWallMs += performance.now() - t0;
  window.__ticks++;
}, 50);
const raf = () => { window.__rafs++; requestAnimationFrame(raf); };
requestAnimationFrame(raf);
</script>`;

const SOAK_MS = 5000;

async function run(browser, rate) {
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.setContent(PAGE);
  await page.waitForTimeout(1500);

  const read = async () => Object.fromEntries(
    (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
  );

  await page.evaluate(() => {
    window.__ticks = 0;
    window.__busyWallMs = 0;
    window.__rafs = 0;
    window.__t0 = performance.now();
  });
  const before = await read();
  await page.waitForTimeout(SOAK_MS);
  const after = await read();
  const inPage = await page.evaluate(() => ({
    ticks: window.__ticks,
    busyWallMs: window.__busyWallMs,
    rafs: window.__rafs,
  }));

  const delta = (key) => ((after[key] ?? 0) - (before[key] ?? 0)) * 1000;
  await page.close();
  return {
    rate,
    ticks: inPage.ticks,
    rafs: inPage.rafs,
    busyMsPerTick: +(inPage.busyWallMs / inPage.ticks).toFixed(3),
    ScriptDurationMs: +delta('ScriptDuration').toFixed(1),
    TaskDurationMs: +delta('TaskDuration').toFixed(1),
    ThreadTimeMs: +delta('ThreadTime').toFixed(1),
  };
}

const browser = await chromium.launch();
const rows = [];
// Interleaved, twice each, for the same reason the benchmark interleaves.
for (const pass of [0, 1]) {
  for (const rate of [1, 4]) rows.push({ pass, ...await run(browser, rate) });
}
await browser.close();

console.table(rows);

const mean = (rate, key) => {
  const at = rows.filter((row) => row.rate === rate);
  return at.reduce((sum, row) => sum + row[key], 0) / at.length;
};
console.log('\n4× / 1×, on identical work:\n');
for (const key of ['ticks', 'rafs', 'busyMsPerTick', 'ScriptDurationMs', 'TaskDurationMs', 'ThreadTimeMs']) {
  console.log(
    `  ${key.padEnd(18)}${(mean(4, key) / mean(1, key)).toFixed(2)}×`,
  );
}
console.log(
  '\nThe work is identical at both levels. If ThreadTime multiplies while'
  + '\nScriptDuration does not, the throttle is stealing thread time outside'
  + '\nthe script counters, and scripting ms/s cannot be compared across levels.\n',
);
