import { describe, expect, it } from 'vitest';
import {
  avgHoldingMs, equityCurve, maxDrawdown, profitFactor,
  rMultiple, realizedPnl, unrealizedPnl, winRate,
} from './calculations';
import type { Position, Trade } from './types';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    instrumentId: 'BTC-USDT',
    side: 'long',
    size: 1,
    entryPrice: 100,
    exitPrice: 110,
    openedAt: 0,
    closedAt: 1000,
    riskAmount: 5,
    strategy: 'breakout',
    note: '',
    ...overrides,
  };
}

const position: Position = {
  id: 'p1',
  instrumentId: 'BTC-USDT',
  side: 'long',
  size: 2,
  entryPrice: 100,
  openedAt: 0,
  riskAmount: 10,
};

describe('unrealizedPnl', () => {
  it('is positive for a long above entry', () => {
    expect(unrealizedPnl(position, 110)).toBe(20);
  });

  it('is negative for a long below entry', () => {
    expect(unrealizedPnl(position, 95)).toBe(-10);
  });

  it('inverts for a short', () => {
    expect(unrealizedPnl({ ...position, side: 'short' }, 90)).toBe(20);
  });
});

describe('realizedPnl', () => {
  it('accounts for size and direction', () => {
    expect(realizedPnl(trade({ size: 3 }))).toBe(30);
    expect(realizedPnl(trade({ side: 'short' }))).toBe(-10);
  });
});

describe('rMultiple', () => {
  it('divides realized P&L by planned risk', () => {
    expect(rMultiple(trade())).toBe(2);
  });

  it('returns 0 when risk is unknown rather than dividing by zero', () => {
    expect(rMultiple(trade({ riskAmount: 0 }))).toBe(0);
  });
});

describe('winRate', () => {
  it('counts only profitable trades', () => {
    expect(winRate([trade(), trade({ exitPrice: 90 })])).toBe(0.5);
  });

  it('is 0 for an empty history rather than NaN', () => {
    expect(winRate([])).toBe(0);
  });
});

describe('profitFactor', () => {
  it('is gross profit over gross loss', () => {
    // +10 and -5 => 2
    expect(profitFactor([trade(), trade({ exitPrice: 95 })])).toBe(2);
  });

  it('is Infinity when there are no losses', () => {
    expect(profitFactor([trade()])).toBe(Infinity);
  });

  it('is 0 for an empty history', () => {
    expect(profitFactor([])).toBe(0);
  });
});

describe('equityCurve', () => {
  it('accumulates in close order regardless of input order', () => {
    const curve = equityCurve([
      trade({ id: 'b', closedAt: 2000, exitPrice: 90 }),
      trade({ id: 'a', closedAt: 1000, exitPrice: 110 }),
    ]);
    expect(curve).toEqual([
      { ts: 1000, equity: 10 },
      { ts: 2000, equity: 0 },
    ]);
  });

  it('honours a starting equity', () => {
    expect(equityCurve([trade()], 100)[0]).toEqual({ ts: 1000, equity: 110 });
  });
});

describe('maxDrawdown', () => {
  it('is the deepest fall from a running peak', () => {
    expect(maxDrawdown([
      { ts: 1, equity: 100 },
      { ts: 2, equity: 140 },
      { ts: 3, equity: 90 },
      { ts: 4, equity: 120 },
    ])).toBe(-50);
  });

  it('is 0 for a monotonically rising curve', () => {
    expect(maxDrawdown([{ ts: 1, equity: 10 }, { ts: 2, equity: 20 }])).toBe(0);
  });

  it('is 0 for an empty curve', () => {
    expect(maxDrawdown([])).toBe(0);
  });
});

describe('avgHoldingMs', () => {
  it('averages time in trade', () => {
    expect(avgHoldingMs([trade({ closedAt: 1000 }), trade({ closedAt: 3000 })])).toBe(2000);
  });

  it('is 0 for an empty history', () => {
    expect(avgHoldingMs([])).toBe(0);
  });
});
