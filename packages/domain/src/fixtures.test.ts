import { describe, expect, it } from 'vitest';
import { STRATEGIES, createTradeHistory } from './fixtures';
import { INSTRUMENTS } from './instruments';

const END = 1_800_000_000_000;

describe('createTradeHistory', () => {
  it('produces the requested number of trades', () => {
    expect(createTradeHistory(1, 250, END)).toHaveLength(250);
  });

  it('replays identically for the same seed', () => {
    expect(createTradeHistory(7, 50, END)).toEqual(createTradeHistory(7, 50, END));
  });

  it('diverges for a different seed', () => {
    expect(createTradeHistory(7, 50, END)).not.toEqual(createTradeHistory(8, 50, END));
  });

  it('assigns unique ids', () => {
    const trades = createTradeHistory(1, 250, END);
    expect(new Set(trades.map((t) => t.id)).size).toBe(250);
  });

  it('sorts ascending by close time', () => {
    const trades = createTradeHistory(1, 100, END);
    const closes = trades.map((t) => t.closedAt);
    expect(closes).toEqual([...closes].sort((a, b) => a - b));
  });

  it('closes every trade after it opened', () => {
    expect(createTradeHistory(1, 250, END).every((t) => t.closedAt > t.openedAt)).toBe(true);
  });

  it('uses known instruments and strategies', () => {
    const ids = new Set(INSTRUMENTS.map((i) => i.id));
    const trades = createTradeHistory(1, 250, END);
    expect(trades.every((t) => ids.has(t.instrumentId))).toBe(true);
    expect(trades.every((t) => STRATEGIES.includes(t.strategy))).toBe(true);
  });

  it('always assigns positive risk so rMultiple is meaningful', () => {
    expect(createTradeHistory(1, 250, END).every((t) => t.riskAmount > 0)).toBe(true);
  });

  it('contains both winners and losers', () => {
    const trades = createTradeHistory(1, 250, END);
    expect(trades.some((t) => t.exitPrice > t.entryPrice)).toBe(true);
    expect(trades.some((t) => t.exitPrice < t.entryPrice)).toBe(true);
  });
});
