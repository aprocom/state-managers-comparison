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

  it('stops firing once disposed', () => {
    const store = new AppStore({ seed: 11, tradeCount: 60, now: NOW });
    const onFire = vi.fn<(alert: Alert) => void>();
    const dispose = attachAlertEngine(store, onFire);
    dispose();
    onFire.mockClear();
    store.applyQuote(quote({ price: 61000, seq: 1 }));
    expect(onFire).not.toHaveBeenCalled();
  });
});
