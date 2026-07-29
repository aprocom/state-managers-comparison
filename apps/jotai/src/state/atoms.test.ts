import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'jotai';
import type { Alert, Quote } from '@smc/domain';
import {
  applyQuoteAtom, editTradeAtom, filterAtom, instrumentRowAtomFamily, instrumentRowsAtom,
  journalRowsAtom, journalStatsAtom, positionRowsAtom, alertsAtom,
} from './atoms';
import { attachAlertEngine } from './store';

const NOW = Date.UTC(2026, 6, 29);

function quote(overrides: Partial<Quote> = {}): Quote {
  return { instrumentId: 'BTC-USDT', price: 61000, ts: NOW, seq: 1, ...overrides };
}

describe('jotai atoms — quotes', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  const btcRow = () => store.get(instrumentRowsAtom).find((row) => row.id === 'BTC-USDT');

  it('stores the latest price', () => {
    store.set(applyQuoteAtom, quote({ price: 61000 }));
    expect(btcRow()?.price).toBe(61000);
  });

  it('records the direction of the change', () => {
    store.set(applyQuoteAtom, quote({ price: 61000, seq: 1 }));
    expect(btcRow()?.changeDirection).toBe('up');
    store.set(applyQuoteAtom, quote({ price: 60500, seq: 2 }));
    expect(btcRow()?.changeDirection).toBe('down');
  });

  it('drops a stale quote', () => {
    store.set(applyQuoteAtom, quote({ price: 61000, seq: 5 }));
    store.set(applyQuoteAtom, quote({ price: 1, seq: 4 }));
    expect(btcRow()?.price).toBe(61000);
  });

  it('leaves an untouched instrument row identical', () => {
    const before = store.get(instrumentRowAtomFamily('ETH-USDT'));
    store.set(applyQuoteAtom, quote({ instrumentId: 'BTC-USDT', price: 61000, seq: 1 }));
    expect(store.get(instrumentRowAtomFamily('ETH-USDT'))).toBe(before);
  });

  it('moves position P&L with the price', () => {
    const before = store.get(positionRowsAtom).find((row) => row.instrumentId === 'BTC-USDT');
    store.set(applyQuoteAtom, quote({ price: 61000, seq: 1 }));
    const after = store.get(positionRowsAtom).find((row) => row.instrumentId === 'BTC-USDT');
    expect(after?.markPrice).toBe(61000);
    expect(after?.unrealizedPnl).not.toBe(before?.unrealizedPnl);
  });
});

describe('jotai atoms — journal', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it('narrows stats to the filtered set', () => {
    const all = store.get(journalStatsAtom).tradeCount;
    store.set(filterAtom, { strategy: 'breakout', side: null, instrumentId: null });
    const filtered = store.get(journalStatsAtom).tradeCount;
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(all);
  });

  it('combines filters conjunctively', () => {
    store.set(filterAtom, { strategy: 'breakout', side: 'long', instrumentId: null });
    expect(store.get(journalRowsAtom).every((row) => row.side === 'long')).toBe(true);
  });

  it('edits only the targeted trade', () => {
    const target = store.get(journalRowsAtom)[0]!;
    store.set(editTradeAtom, target.id, { note: 'chased the entry' });
    const rows = store.get(journalRowsAtom);
    expect(rows.find((row) => row.id === target.id)?.note).toBe('chased the entry');
    expect(rows.filter((row) => row.note !== '')).toHaveLength(1);
  });
});

describe('jotai atoms — alerts', () => {
  it('reports the seeded risk-per-trade alert', () => {
    const store = createStore();
    expect(store.get(alertsAtom).map((alert) => alert.kind)).toContain('risk-per-trade');
  });

  it('fires each alert once, not once per quote', () => {
    const store = createStore();
    const onFire = vi.fn<(alert: Alert) => void>();
    const dispose = attachAlertEngine(store, onFire);

    for (let seq = 1; seq <= 50; seq += 1) {
      store.set(applyQuoteAtom, quote({ price: 61000 + seq, seq }));
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
    const store = createStore();
    const onFire = vi.fn<(alert: Alert) => void>();
    const dispose = attachAlertEngine(store, onFire);
    const dailyLoss = () => onFire.mock.calls.filter(
      ([alert]) => alert.kind === 'daily-loss-limit',
    ).length;

    store.set(applyQuoteAtom, quote({ price: 20000, seq: 2 }));
    expect(dailyLoss()).toBe(1);

    store.set(applyQuoteAtom, quote({ price: 60000, seq: 3 }));
    expect(dailyLoss()).toBe(1);

    store.set(applyQuoteAtom, quote({ price: 20000, seq: 4 }));
    expect(dailyLoss()).toBe(2);
    dispose();
  });

  it('stops firing once disposed — with a change that would otherwise fire', () => {
    const store = createStore();
    const onFire = vi.fn<(alert: Alert) => void>();
    const dispose = attachAlertEngine(store, onFire);
    dispose();
    onFire.mockClear();
    store.set(applyQuoteAtom, quote({ price: 20000, seq: 2 }));
    expect(onFire).not.toHaveBeenCalled();
  });
});
