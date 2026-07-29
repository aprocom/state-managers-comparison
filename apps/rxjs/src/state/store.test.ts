import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Alert, Quote } from '@smc/domain';
import { createAppStore } from './store';

const NOW = Date.UTC(2026, 6, 29);

function quote(overrides: Partial<Quote> = {}): Quote {
  return { instrumentId: 'BTC-USDT', price: 61000, ts: NOW, seq: 1, ...overrides };
}

describe('rxjs store — quotes', () => {
  let store: ReturnType<typeof createAppStore>;

  beforeEach(() => {
    store = createAppStore({ seed: 1, tradeCount: 20, now: NOW });
  });

  function btcRow() {
    return store.instrumentRows$.getValue().find((row) => row.id === 'BTC-USDT');
  }

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

  it('drops a stale quote from the price map', () => {
    store.applyQuote(quote({ price: 61000, seq: 5 }));
    store.applyQuote(quote({ price: 1, seq: 4 }));
    const position = store.positionRows$.getValue().find((row) => row.instrumentId === 'BTC-USDT');
    expect(position?.markPrice).toBe(61000);
  });

  it('preserves the identity of rows that did not tick', () => {
    const before = store.instrumentRows$.getValue();
    const ethBefore = before.find((row) => row.id === 'ETH-USDT');
    store.applyQuote(quote({ instrumentId: 'BTC-USDT', price: 61000, seq: 1 }));
    const ethAfter = store.instrumentRows$.getValue().find((row) => row.id === 'ETH-USDT');
    expect(ethAfter).toBe(ethBefore);
  });

  it('opens with seeded positions and trades', () => {
    expect(store.positionRows$.getValue().length).toBeGreaterThan(0);
    expect(store.journalStats$.getValue().tradeCount).toBe(20);
  });
});

describe('rxjs store — journal', () => {
  let store: ReturnType<typeof createAppStore>;

  beforeEach(() => {
    store = createAppStore({ seed: 5, tradeCount: 120, now: NOW });
  });

  it('narrows stats to the filtered set', () => {
    const all = store.journalStats$.getValue().tradeCount;
    store.setFilter({ strategy: 'breakout', side: null, instrumentId: null });
    const filtered = store.journalStats$.getValue().tradeCount;
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(all);
  });

  it('combines filters conjunctively', () => {
    store.setFilter({ strategy: 'breakout', side: 'long', instrumentId: null });
    expect(store.journalRows$.getValue().every((row) => row.side === 'long')).toBe(true);
  });

  it('edits only the targeted trade', () => {
    const target = store.journalRows$.getValue()[0]!;
    store.editTrade(target.id, { note: 'chased the entry' });
    const rows = store.journalRows$.getValue();
    expect(rows.find((row) => row.id === target.id)?.note).toBe('chased the entry');
    expect(rows.filter((row) => row.note !== '')).toHaveLength(1);
  });
});

describe('rxjs store — alerts', () => {
  it('fires the seeded risk-per-trade alert', () => {
    const store = createAppStore({ seed: 11, tradeCount: 60, now: NOW });
    const kinds = store.alerts$.getValue().map((alert) => alert.kind);
    expect(kinds).toContain('risk-per-trade');
    store.destroy();
  });

  it('fires each alert once, not once per quote', () => {
    const store = createAppStore({ seed: 11, tradeCount: 60, now: NOW });
    const onFire = vi.fn<(alert: Alert) => void>();
    store.onAlertFired(onFire);

    for (let seq = 1; seq <= 50; seq += 1) {
      store.applyQuote(quote({ price: 61000 + seq, seq }));
    }

    expect(onFire.mock.calls.filter(([alert]) => alert.kind === 'risk-per-trade')).toHaveLength(1);
    store.destroy();
  });

  it('keeps the alert array identity stable while the alert set is unchanged', () => {
    const store = createAppStore({ seed: 11, tradeCount: 60, now: NOW });
    const before = store.alerts$.getValue();
    store.applyQuote(quote({ price: 61000, seq: 1 }));
    expect(store.alerts$.getValue()).toBe(before);
    store.destroy();
  });
});
