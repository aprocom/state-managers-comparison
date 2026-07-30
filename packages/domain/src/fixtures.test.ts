import { describe, expect, it } from 'vitest';
import { STRATEGIES, createTradeHistory, seedPositions } from './fixtures';
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

describe('seedPositions', () => {
  it('opens six positions on the first six instruments', () => {
    const positions = seedPositions(20260729, END);
    expect(positions).toHaveLength(6);
    expect(positions.map((p) => p.instrumentId))
      .toEqual(INSTRUMENTS.slice(0, 6).map((i) => i.id));
  });

  it('replays identically for the same seed and diverges for another', () => {
    expect(seedPositions(7, END)).toEqual(seedPositions(7, END));
    expect(seedPositions(7, END)).not.toEqual(seedPositions(8, END));
  });

  /**
   * These two are not incidental. The fixture exists to give the alert rules
   * something to fire on: without a long-held position the time-in-trade rule
   * has no subject, and without a breach the per-trade risk rule never trips.
   * All five implementations are compared on the alert set they produce.
   */
  it('holds one position long enough to trip the time-in-trade rule', () => {
    const positions = seedPositions(20260729, END);
    expect(positions.some((p) => END - p.openedAt >= 40 * 60 * 60 * 1000)).toBe(true);
  });

  it('breaches the per-trade risk limit exactly once', () => {
    const positions = seedPositions(20260729, END);
    expect(positions.filter((p) => p.riskAmount > 100)).toHaveLength(1);
  });

  it('is anchored to the clock it is given', () => {
    const [first] = seedPositions(3, END);
    const [shifted] = seedPositions(3, END + 1000);
    expect(shifted!.openedAt - first!.openedAt).toBe(1000);
  });
});
