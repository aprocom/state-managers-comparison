import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Alert, Quote } from '@smc/domain';
import { AppStore, attachAlertEngine } from './store';

const NOW = Date.UTC(2026, 6, 29);

function quote(overrides: Partial<Quote> = {}): Quote {
  return { instrumentId: 'BTC-USDT', price: 61000, ts: NOW, seq: 1, ...overrides };
}

describe('mobx store — quotes', () => {
  let store: AppStore;

  beforeEach(() => {
    store = new AppStore({ seed: 1, tradeCount: 20, now: NOW });
  });

  const btcRow = () => store.instrumentRows.find((row) => row.id === 'BTC-USDT');

  it('stores the latest price', () => {
    store.applyQuote(quote({ price: 61000 }));
    expect(btcRow()?.price).toBe(61000);
  });

  it('records the direction of the change', () => {
    store.applyQuote(quote({ price: 61000, seq: 1 }));
    expect(btcRow()?.changeDirection).toBe('up');
    store.applyQuote(quote({ price: 60500, seq: 2 }));
    expect(btcRow()?.changeDirection).toBe('down');
  });

  it('drops a stale quote', () => {
    store.applyQuote(quote({ price: 61000, seq: 5 }));
    store.applyQuote(quote({ price: 1, seq: 4 }));
    expect(btcRow()?.price).toBe(61000);
  });

  it('opens with seeded positions and trades', () => {
    expect(store.positionRows.length).toBeGreaterThan(0);
    expect(store.journalStats.tradeCount).toBe(20);
  });
});

describe('mobx store — journal', () => {
  let store: AppStore;

  beforeEach(() => {
    store = new AppStore({ seed: 5, tradeCount: 120, now: NOW });
  });

  it('narrows stats to the filtered set', () => {
    const all = store.journalStats.tradeCount;
    store.setFilter({ strategy: 'breakout', side: null, instrumentId: null });
    const filtered = store.journalStats.tradeCount;
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(all);
  });

  it('combines filters conjunctively', () => {
    store.setFilter({ strategy: 'breakout', side: 'long', instrumentId: null });
    expect(store.journalRows.every((row) => row.side === 'long')).toBe(true);
  });

  it('edits only the targeted trade', () => {
    const target = store.journalRows[0]!;
    store.editTrade(target.id, { note: 'chased the entry' });
    expect(store.journalRows.find((row) => row.id === target.id)?.note).toBe('chased the entry');
    expect(store.journalRows.filter((row) => row.note !== '')).toHaveLength(1);
  });
});

describe('mobx store — alerts', () => {
  it('reports the seeded risk-per-trade alert', () => {
    const store = new AppStore({ seed: 11, tradeCount: 60, now: NOW });
    expect(store.alerts.map((alert) => alert.kind)).toContain('risk-per-trade');
  });

  it('fires each alert once, not once per quote', () => {
    const store = new AppStore({ seed: 11, tradeCount: 60, now: NOW });
    const onFire = vi.fn<(alert: Alert) => void>();
    const dispose = attachAlertEngine(store, onFire);

    for (let seq = 1; seq <= 50; seq += 1) {
      store.applyQuote(quote({ price: 61000 + seq, seq }));
    }

    expect(onFire.mock.calls.filter(([alert]) => alert.kind === 'risk-per-trade')).toHaveLength(1);
    dispose();
  });

  /**
   * The requirement the whole comparison rests on: an alert fires once when the
   * condition becomes true, stays quiet while it holds, and fires again after
   * it has cleared and returned. Until now this existed only in the Zustand
   * suite; the other four asserted only that a detached engine goes quiet,
   * which passes even if the engine was never attached.
   *
   * Driven entirely through applyQuote, the one API all five expose: dropping
   * BTC far enough puts unrealised P&L past the -400 daily loss limit.
   */
  it('re-fires after the condition clears and returns', () => {
    const store = new AppStore({ seed: 11, tradeCount: 60, now: NOW });
    const onFire = vi.fn<(alert: Alert) => void>();
    const dispose = attachAlertEngine(store, onFire);
    const dailyLoss = () => onFire.mock.calls.filter(
      ([alert]) => alert.kind === 'daily-loss-limit',
    ).length;

    store.applyQuote(quote({ price: 20000, seq: 2 }));
    expect(dailyLoss()).toBe(1);

    store.applyQuote(quote({ price: 60000, seq: 3 }));
    expect(dailyLoss()).toBe(1);

    store.applyQuote(quote({ price: 20000, seq: 4 }));
    expect(dailyLoss()).toBe(2);
    dispose();
  });

  it('stops firing once disposed — with a change that would otherwise fire', () => {
    const store = new AppStore({ seed: 11, tradeCount: 60, now: NOW });
    const onFire = vi.fn<(alert: Alert) => void>();
    const dispose = attachAlertEngine(store, onFire);
    dispose();
    onFire.mockClear();
    // A quote that provably triggers the daily-loss alert when attached, so
    // this cannot pass by nothing having happened.
    store.applyQuote(quote({ price: 20000, seq: 2 }));
    expect(onFire).not.toHaveBeenCalled();
  });
});
