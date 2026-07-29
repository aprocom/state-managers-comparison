import type { Position, Side, Trade } from './types';

function direction(side: Side): 1 | -1 {
  return side === 'long' ? 1 : -1;
}

export function unrealizedPnl(position: Position, price: number): number {
  return (price - position.entryPrice) * position.size * direction(position.side);
}

export function realizedPnl(trade: Trade): number {
  return (trade.exitPrice - trade.entryPrice) * trade.size * direction(trade.side);
}

export function rMultiple(trade: Trade): number {
  if (trade.riskAmount <= 0) return 0;
  return realizedPnl(trade) / trade.riskAmount;
}

export function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return trades.filter((trade) => realizedPnl(trade) > 0).length / trades.length;
}

export function profitFactor(trades: Trade[]): number {
  let grossProfit = 0;
  let grossLoss = 0;
  for (const trade of trades) {
    const pnl = realizedPnl(trade);
    if (pnl > 0) grossProfit += pnl;
    else grossLoss -= pnl;
  }
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
}

export interface EquityPoint {
  ts: number;
  equity: number;
}

export function equityCurve(trades: Trade[], startingEquity = 0): EquityPoint[] {
  // Tie-broken by id, not left to the caller's array order. Two trades closed
  // in the same millisecond produce different intermediate equity points
  // depending on which is applied first, and the five implementations do not
  // hold their trades in the same order — Redux's entity adapter keeps them
  // newest-first, the others keep insertion order. Without the tie-break the
  // same fixture can yield a different max drawdown in different apps, which is
  // precisely the kind of silent divergence the cross-app suite exists to
  // forbid.
  const ordered = [...trades].sort((a, b) => a.closedAt - b.closedAt
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let equity = startingEquity;
  return ordered.map((trade) => {
    equity += realizedPnl(trade);
    return { ts: trade.closedAt, equity };
  });
}

/** Zero or negative. The deepest fall from a running peak, in quote currency. */
export function maxDrawdown(curve: EquityPoint[]): number {
  let peak = Number.NEGATIVE_INFINITY;
  let worst = 0;
  for (const point of curve) {
    if (point.equity > peak) peak = point.equity;
    const drawdown = point.equity - peak;
    if (drawdown < worst) worst = drawdown;
  }
  return worst;
}

export function avgHoldingMs(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const total = trades.reduce((sum, trade) => sum + (trade.closedAt - trade.openedAt), 0);
  return total / trades.length;
}
