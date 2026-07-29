import { defineConfig } from '@playwright/test';
import { APP_TARGETS } from './packages/bench/src/apps';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] === undefined ? 0 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'on-first-retry' },
  webServer: APP_TARGETS.map((target) => ({
    command: `npm run preview -w ${target.workspace} -- --port ${target.port} --strictPort`,
    port: target.port,
    // Never reuse. A server left over from an earlier build keeps serving the
    // old dist, and Playwright says nothing — a benchmark run that straddles a
    // rebuild silently mixes samples from two different versions of the app.
    // That happened here once and cost a full run.
    reuseExistingServer: false,
    timeout: 120_000,
  })),
});
