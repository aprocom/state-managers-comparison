import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Alert, Quote } from '@smc/domain';
import {
  createAppStore, createInitialState, filterSet, quoteApplied, tradeEdited,
} from './slice';
import {
  selectInstrumentRows, selectJournalRows, selectJournalStats, selectPositionRows,
} from './selectors';
import { attachAlertEngine } from './alertEngine';

const NOW = Date.UTC(2026, 6, 29);

function quote(overrides: Partial<Quote> = {}): Quote {
  return { instrumentId: 'BTC-USDT', price: 61000, ts: NOW, seq: 1, ...overrides };
}

describe('redux slice — quotes', () => {
  let store: ReturnType<typeof createAppStore>;

  beforeEach(() => {
    store = createAppStore(createInitialState(1, 20, NOW));
  });

  const btcRow = () => selectInstrumentRows(store.getState()).find((row) => row.id === 'BTC-USDT');

  it('stores the latest price', () => {
    store.dispatch(quoteApplied(quote({ price: 61000 })));
    expect(btcRow()?.price).toBe(61000);
  });

  it('records the direction of the change', () => {
    store.dispatch(quoteApplied(quote({ price: 61000, seq: 1 })));
    expect(btcRow()?.changeDirection).toBe('up');
    store.dispatch(quoteApplied(quote({ price: 60500, seq: 2 })));
    expect(btcRow()?.changeDirection).toBe('down');
  });

  it('drops a stale quote', () => {
    store.dispatch(quoteApplied(quote({ price: 61000, seq: 5 })));
    store.dispatch(quoteApplied(quote({ price: 1, seq: 4 })));
    expect(btcRow()?.price).toBe(61000);
  });

  it('keeps an untouched row identical', () => {
    const before = selectInstrumentRows(store.getState()).find((row) => row.id === 'ETH-USDT');
    store.dispatch(quoteApplied(quote({ price: 61000, seq: 1 })));
    expect(selectInstrumentRows(store.getState()).find((row) => row.id === 'ETH-USDT'))
      .toBe(before);
  });

  it('opens with seeded positions and trades', () => {
    expect(selectPositionRows(store.getState()).length).toBeGreaterThan(0);
    expect(selectJournalStats(store.getState()).tradeCount).toBe(20);
  });
});

describe('redux slice — journal', () => {
  let store: ReturnType<typeof createAppStore>;

  beforeEach(() => {
    store = createAppStore(createInitialState(5, 120, NOW));
  });

  it('narrows stats to the filtered set', () => {
    const all = selectJournalStats(store.getState()).tradeCount;
    store.dispatch(filterSet({ strategy: 'breakout', side: null, instrumentId: null }));
    const filtered = selectJournalStats(store.getState()).tradeCount;
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(all);
  });

  it('combines filters conjunctively', () => {
    store.dispatch(filterSet({ strategy: 'breakout', side: 'long', instrumentId: null }));
    expect(selectJournalRows(store.getState()).every((row) => row.side === 'long')).toBe(true);
  });

  it('edits only the targeted trade', () => {
    const target = selectJournalRows(store.getState())[0]!;
    store.dispatch(tradeEdited({ id: target.id, patch: { note: 'chased the entry' } }));
    const rows = selectJournalRows(store.getState());
    expect(rows.find((row) => row.id === target.id)?.note).toBe('chased the entry');
    expect(rows.filter((row) => row.note !== '')).toHaveLength(1);
  });
});

describe('redux slice — alerts', () => {
  it('fires each alert once, not once per quote', () => {
    const store = createAppStore(createInitialState(11, 60, NOW));
    const onFire = vi.fn<(alert: Alert) => void>();
    const detach = attachAlertEngine(store, {
      now: () => NOW, onFire, onChange: () => {},
    });

    for (let seq = 1; seq <= 50; seq += 1) {
      store.dispatch(quoteApplied(quote({ price: 61000 + seq, seq })));
    }

    expect(onFire.mock.calls.filter(([alert]) => alert.kind === 'risk-per-trade')).toHaveLength(1);
    detach();
  });

  it('stops evaluating once detached', () => {
    const store = createAppStore(createInitialState(11, 60, NOW));
    const onFire = vi.fn<(alert: Alert) => void>();
    const detach = attachAlertEngine(store, { now: () => NOW, onFire, onChange: () => {} });
    detach();
    onFire.mockClear();
    store.dispatch(quoteApplied(quote({ price: 61000, seq: 1 })));
    expect(onFire).not.toHaveBeenCalled();
  });
});
