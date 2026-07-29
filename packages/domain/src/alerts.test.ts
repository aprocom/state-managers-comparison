import { describe, expect, it } from 'vitest';
import { TILT_WINDOW_MS, evaluateAlerts } from './alerts';
import type { AlertContext } from './alerts';
import type { Position, Trade } from './types';

const NOW = 10_000_000;

function losing(id: string, closedAt: number): Trade {
  return {
    id, instrumentId: 'BTC-USDT', side: 'long', size: 1,
    entryPrice: 100, exitPrice: 90, openedAt: closedAt - 1000, closedAt,
    riskAmount: 10, strategy: 'breakout', note: '',
  };
}

function winning(id: string, closedAt: number): Trade {
  return { ...losing(id, closedAt), exitPrice: 110 };
}

const position: Position = {
  id: 'p1', instrumentId: 'BTC-USDT', side: 'long', size: 1,
  entryPrice: 100, openedAt: NOW - 1000, riskAmount: 50,
};

function context(overrides: Partial<AlertContext> = {}): AlertContext {
  return {
    now: NOW,
    dailyPnl: 0,
    dailyLossLimit: 400,
    riskLimitPerTrade: 100,
    recentClosedTrades: [],
    openPositions: [],
    avgHoldingMs: 1000,
    ...overrides,
  };
}

describe('evaluateAlerts — daily loss limit', () => {
  it('fires when the day is at or beyond the limit', () => {
    const alerts = evaluateAlerts(context({ dailyPnl: -400 }));
    expect(alerts.map((a) => a.kind)).toContain('daily-loss-limit');
  });

  it('stays quiet just inside the limit', () => {
    expect(evaluateAlerts(context({ dailyPnl: -399 }))).toEqual([]);
  });

  it('stays quiet on a profitable day', () => {
    expect(evaluateAlerts(context({ dailyPnl: 900 }))).toEqual([]);
  });
});

describe('evaluateAlerts — risk per trade', () => {
  it('fires for a position risking more than the limit', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position: { ...position, riskAmount: 150 }, holdingMs: 10 }],
      riskLimitPerTrade: 100,
    }));
    expect(alerts).toEqual([
      expect.objectContaining({ kind: 'risk-per-trade', subjectId: 'p1' }),
    ]);
  });

  it('stays quiet at exactly the limit', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position: { ...position, riskAmount: 100 }, holdingMs: 10 }],
    }));
    expect(alerts).toEqual([]);
  });
});

describe('evaluateAlerts — tilt', () => {
  it('fires on four consecutive losses inside the window', () => {
    const alerts = evaluateAlerts(context({
      recentClosedTrades: [
        losing('a', NOW - 100), losing('b', NOW - 200),
        losing('c', NOW - 300), losing('d', NOW - 400),
      ],
    }));
    expect(alerts.map((a) => a.kind)).toContain('tilt');
  });

  it('stays quiet on three consecutive losses', () => {
    const alerts = evaluateAlerts(context({
      recentClosedTrades: [losing('a', NOW - 100), losing('b', NOW - 200), losing('c', NOW - 300)],
    }));
    expect(alerts).toEqual([]);
  });

  it('breaks the streak on a profitable trade', () => {
    const alerts = evaluateAlerts(context({
      recentClosedTrades: [
        losing('a', NOW - 100), winning('w', NOW - 150),
        losing('b', NOW - 200), losing('c', NOW - 300), losing('d', NOW - 400),
      ],
    }));
    expect(alerts).toEqual([]);
  });

  it('ignores losses older than the window', () => {
    const alerts = evaluateAlerts(context({
      recentClosedTrades: [
        losing('a', NOW - 100), losing('b', NOW - 200),
        losing('c', NOW - TILT_WINDOW_MS - 1), losing('d', NOW - TILT_WINDOW_MS - 2),
      ],
    }));
    expect(alerts).toEqual([]);
  });
});

describe('evaluateAlerts — time in trade', () => {
  it('fires beyond three times the average holding time', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position, holdingMs: 3001 }],
      avgHoldingMs: 1000,
    }));
    expect(alerts.map((a) => a.kind)).toContain('time-in-trade');
  });

  it('stays quiet at exactly three times', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position, holdingMs: 3000 }],
      avgHoldingMs: 1000,
    }));
    expect(alerts).toEqual([]);
  });

  it('stays quiet when there is no holding-time history', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position, holdingMs: 999_999 }],
      avgHoldingMs: 0,
    }));
    expect(alerts).toEqual([]);
  });
});

describe('evaluateAlerts — combinations', () => {
  it('reports every triggered rule', () => {
    const alerts = evaluateAlerts(context({
      dailyPnl: -500,
      openPositions: [{ position: { ...position, riskAmount: 150 }, holdingMs: 9000 }],
      avgHoldingMs: 1000,
    }));
    expect(alerts.map((a) => a.kind).sort()).toEqual(
      ['daily-loss-limit', 'risk-per-trade', 'time-in-trade'],
    );
  });

  it('is pure — the same context yields an equal result', () => {
    const ctx = context({ dailyPnl: -500 });
    expect(evaluateAlerts(ctx)).toEqual(evaluateAlerts(ctx));
  });
});
