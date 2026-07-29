import { describe, expect, it } from 'vitest';
import { createAppStore } from './store';
import { selectFilteredTrades, selectJournalStats } from './selectors';

const NOW = 1_800_000_000_000;

function store() {
  return createAppStore({ seed: 5, tradeCount: 120, now: NOW });
}

describe('selectFilteredTrades', () => {
  it('returns everything when no filter is set', () => {
    const s = store();
    expect(selectFilteredTrades(s.getState())).toHaveLength(120);
  });

  it('filters by strategy', () => {
    const s = store();
    s.getState().setFilter({ strategy: 'breakout', side: null, instrumentId: null });
    const filtered = selectFilteredTrades(s.getState());
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((t) => t.strategy === 'breakout')).toBe(true);
  });

  it('filters by side', () => {
    const s = store();
    s.getState().setFilter({ strategy: null, side: 'short', instrumentId: null });
    expect(selectFilteredTrades(s.getState()).every((t) => t.side === 'short')).toBe(true);
  });

  it('combines filters conjunctively', () => {
    const s = store();
    s.getState().setFilter({ strategy: 'breakout', side: 'long', instrumentId: null });
    expect(selectFilteredTrades(s.getState())
      .every((t) => t.strategy === 'breakout' && t.side === 'long')).toBe(true);
  });

  it('returns a stable reference while nothing changes', () => {
    const s = store();
    expect(selectFilteredTrades(s.getState())).toBe(selectFilteredTrades(s.getState()));
  });
});

describe('selectJournalStats', () => {
  it('reports stats over the filtered set, not the whole history', () => {
    const s = store();
    const all = selectJournalStats(s.getState()).tradeCount;
    s.getState().setFilter({ strategy: 'breakout', side: null, instrumentId: null });
    expect(selectJournalStats(s.getState()).tradeCount).toBeLessThan(all);
  });

  it('keeps win rate inside [0, 1]', () => {
    const stats = selectJournalStats(store().getState());
    expect(stats.winRate).toBeGreaterThanOrEqual(0);
    expect(stats.winRate).toBeLessThanOrEqual(1);
  });

  it('reports a non-positive max drawdown', () => {
    expect(selectJournalStats(store().getState()).maxDrawdown).toBeLessThanOrEqual(0);
  });
});

describe('editTrade', () => {
  it('updates only the targeted trade', () => {
    const s = store();
    const target = s.getState().trades[0]!;
    s.getState().editTrade(target.id, { note: 'chased the entry' });
    const trades = s.getState().trades;
    expect(trades.find((t) => t.id === target.id)?.note).toBe('chased the entry');
    expect(trades.filter((t) => t.note !== '')).toHaveLength(1);
  });
});
