import { expect, test } from '@playwright/test';
import { TESTID } from '@smc/ui';
import { APP_TARGETS } from '@smc/bench';

for (const target of APP_TARGETS) {
  test.describe(`${target.name} — functional parity`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`http://localhost:${target.port}/`);
    });

    test('opens on the terminal screen', async ({ page }) => {
      await expect(page.getByTestId(TESTID.screenTerminal)).toBeVisible();
    });

    test('streams price updates', async ({ page }) => {
      const price = page.getByTestId(TESTID.instrumentPrice('BTC-USDT'));
      const before = await price.textContent();
      await expect(price).not.toHaveText(before ?? '', { timeout: 5000 });
    });

    test('moves position P&L with the price', async ({ page }) => {
      const pnl = page.getByTestId(TESTID.positionPnl('pos-0'));
      const before = await pnl.textContent();
      await expect(pnl).not.toHaveText(before ?? '', { timeout: 5000 });
    });

    test('raises the seeded risk-per-trade alert', async ({ page }) => {
      await expect(page.locator('[data-alert-kind="risk-per-trade"]').first()).toBeVisible();
    });

    test('pins an instrument to the top of the table', async ({ page }) => {
      await page.getByTestId(TESTID.instrumentPin('SOL-USDT')).click();
      await expect(page.getByTestId(TESTID.accountPinned)).toHaveText('1');
      const firstRow = page.getByTestId(TESTID.instrumentTable).locator('tbody tr').first();
      await expect(firstRow).toHaveAttribute('data-testid', TESTID.instrumentRow('SOL-USDT'));

      await page.getByTestId(TESTID.instrumentPin('SOL-USDT')).click();
      await expect(page.getByTestId(TESTID.accountPinned)).toHaveText('0');
    });

    test('keeps pins across a screen switch', async ({ page }) => {
      await page.getByTestId(TESTID.instrumentPin('ETH-USDT')).click();
      await page.getByTestId(TESTID.navJournal).click();
      await page.getByTestId(TESTID.navTerminal).click();
      await expect(page.getByTestId(TESTID.accountPinned)).toHaveText('1');
    });

    test('switches to the journal', async ({ page }) => {
      await page.getByTestId(TESTID.navJournal).click();
      await expect(page.getByTestId(TESTID.screenJournal)).toBeVisible();
      await expect(page.getByTestId(TESTID.statTradeCount)).toHaveText('250');
    });

    test('narrows the journal by strategy', async ({ page }) => {
      await page.getByTestId(TESTID.navJournal).click();
      const total = Number(await page.getByTestId(TESTID.statTradeCount).textContent());
      await page.getByTestId(TESTID.filterStrategy).selectOption('breakout');
      const filtered = Number(await page.getByTestId(TESTID.statTradeCount).textContent());
      expect(filtered).toBeGreaterThan(0);
      expect(filtered).toBeLessThan(total);
    });

    test('persists a note across screen switches', async ({ page }) => {
      await page.getByTestId(TESTID.navJournal).click();
      const firstRow = page.getByTestId(TESTID.screenJournal).locator('tbody tr').first();
      const note = firstRow.locator('input');
      await note.fill('chased the entry');
      await page.getByTestId(TESTID.navTerminal).click();
      await page.getByTestId(TESTID.navJournal).click();
      await expect(
        page.getByTestId(TESTID.screenJournal).locator('tbody tr').first().locator('input'),
      ).toHaveValue('chased the entry');
    });

    test('changes tick rate without breaking the stream', async ({ page }) => {
      await page.getByTestId(TESTID.feedRate(100)).click();
      const price = page.getByTestId(TESTID.instrumentPrice('ETH-USDT'));
      const before = await price.textContent();
      await expect(price).not.toHaveText(before ?? '', { timeout: 5000 });
    });
  });
}
