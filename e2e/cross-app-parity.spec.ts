import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TESTID } from '@smc/ui';
import { APP_TARGETS } from '@smc/bench';

/**
 * The parity suite next door asserts each app against loose predicates — "the
 * price changed", "some rows survived the filter" — independently. All five
 * could be consistently wrong and it would stay green, which is exactly what
 * happened: two implementations diverged on position-row granularity while the
 * suite reported forty passes.
 *
 * This file asserts the apps against *each other*. It reads an exact value
 * vector from every implementation and requires them to be identical.
 *
 * Every field is deliberately independent of the live price feed. Unrealised
 * P&L moves with a stream that no two page loads observe at the same instant,
 * so comparing it would be comparing timing. What is compared instead is
 * everything derived from the seeded fixture: closed-trade statistics, journal
 * row values, risk totals, and the alert key set.
 */
async function readVector(page: Page, port: number): Promise<Record<string, string>> {
  await page.goto(`http://localhost:${port}/`);
  await expect(page.getByTestId(TESTID.screenTerminal)).toBeVisible();

  const vector: Record<string, string> = {};

  // Terminal: the two totals that do not move with the price.
  vector['account.risk'] = (await page.getByTestId(TESTID.accountRisk).textContent()) ?? '';
  vector['account.drawdown'] = (await page.getByTestId(TESTID.accountDrawdown).textContent()) ?? '';

  // The alert set, as a sorted key list. Content, not just visibility.
  const alertIds = await page.getByTestId(TESTID.alertList).locator('[data-testid^="alert-"]')
    .evaluateAll((nodes) => nodes
      .map((node) => node.getAttribute('data-testid') ?? '')
      .sort()
      .join(','));
  vector['alerts'] = alertIds;

  await page.getByTestId(TESTID.navJournal).click();
  await expect(page.getByTestId(TESTID.screenJournal)).toBeVisible();

  const stats = async (prefix: string): Promise<void> => {
    for (const [name, id] of [
      ['tradeCount', TESTID.statTradeCount],
      ['winRate', TESTID.statWinRate],
      ['profitFactor', TESTID.statProfitFactor],
      ['maxDrawdown', TESTID.statMaxDrawdown],
      ['avgHolding', TESTID.statAvgHolding],
    ] as const) {
      vector[`${prefix}.${name}`] = (await page.getByTestId(id).textContent()) ?? '';
    }
  };

  await stats('all');

  // The first twenty rows, whole. Catches divergent sort order, rounding, and
  // any difference in the derived P&L or R-multiple.
  vector['rows.first20'] = await page.getByTestId(TESTID.screenJournal)
    .locator('tbody tr')
    .evaluateAll((rows) => rows
      .slice(0, 20)
      .map((row) => Array.from(row.querySelectorAll('td'))
        .map((cell) => {
          const input = cell.querySelector('input, select');
          if (input !== null) return (input as HTMLInputElement | HTMLSelectElement).value;
          return cell.textContent ?? '';
        })
        .join('|'))
      .join('\n'));

  // And again through a filter, so the filter predicate is compared too.
  await page.getByTestId(TESTID.filterStrategy).selectOption('breakout');
  await stats('breakout');
  await page.getByTestId(TESTID.filterSide).selectOption('long');
  await stats('breakout+long');

  return vector;
}

test.describe.configure({ mode: 'serial' });

test('all five implementations produce identical derived state', async ({ page }) => {
  test.setTimeout(120_000);

  const vectors: { name: string; vector: Record<string, string> }[] = [];
  for (const target of APP_TARGETS) {
    vectors.push({ name: target.name, vector: await readVector(page, target.port) });
  }

  const [reference, ...rest] = vectors;
  expect(reference).toBeDefined();
  if (reference === undefined) return;

  // A vector of empty strings would make every app trivially equal, so assert
  // the reference actually read something before comparing anything to it.
  expect(reference.vector['all.tradeCount']).toBe('250');
  expect(reference.vector['alerts'] ?? '').not.toBe('');
  expect((reference.vector['rows.first20'] ?? '').split('\n')).toHaveLength(20);

  for (const { name, vector } of rest) {
    for (const key of Object.keys(reference.vector)) {
      expect(
        vector[key],
        `${name} disagrees with ${reference.name} on ${key}`,
      ).toBe(reference.vector[key]);
    }
  }
});
