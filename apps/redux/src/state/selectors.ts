import { createSelector } from 'reselect';
import {
  INSTRUMENTS, avgHoldingMs, equityCurve, evaluateAlerts, maxDrawdown, profitFactor,
  rMultiple, realizedPnl, unrealizedPnl, winRate,
} from '@smc/domain';
import type { Alert, AlertContext, EquityPoint, InstrumentId, Trade } from '@smc/domain';
import type { InstrumentRowModel, JournalRowModel, PositionRowModel } from '@smc/ui';
import type { RootState } from './slice';

export const DAILY_LOSS_LIMIT = 400;
export const RISK_LIMIT_PER_TRADE = 100;

const LABELS = new Map(INSTRUMENTS.map((i) => [i.id, `${i.base}/${i.quote}`]));
const PRECISIONS = new Map(INSTRUMENTS.map((i) => [i.id, i.pricePrecision]));

const selectPrices = (state: RootState) => state.app.prices;
const selectDirections = (state: RootState) => state.app.priceDirections;
const selectPositions = (state: RootState) => state.app.positions;
const selectTrades = (state: RootState) => state.app.trades;
const selectFilter = (state: RootState) => state.app.filter;

/**
 * Redux derives nothing on its own, so every view model here is a reselect
 * memoised selector — the same manual derivation layer Zustand needs, just
 * with a library behind it. The per-row identity cache below is likewise hand
 * written; MobX and Jotai get it from their dependency graphs for free.
 */
const instrumentRowCache = new Map<InstrumentId, InstrumentRowModel>();

export const selectInstrumentRows = createSelector(
  [selectPrices, selectDirections],
  (prices, directions): InstrumentRowModel[] => INSTRUMENTS.map((instrument) => {
    const price = prices[instrument.id] ?? 0;
    const changeDirection = directions[instrument.id] ?? 'flat';
    const cached = instrumentRowCache.get(instrument.id);
    if (cached !== undefined
      && cached.price === price
      && cached.changeDirection === changeDirection) {
      return cached;
    }
    const row: InstrumentRowModel = {
      id: instrument.id,
      label: LABELS.get(instrument.id) ?? instrument.id,
      price,
      precision: PRECISIONS.get(instrument.id) ?? 2,
      changeDirection,
    };
    instrumentRowCache.set(instrument.id, row);
    return row;
  }),
);

const positionRowCache = new Map<string, PositionRowModel>();

export const selectPositionRows = createSelector(
  [selectPositions, selectPrices],
  (positions, prices): PositionRowModel[] => positions.map((position) => {
    const markPrice = prices[position.instrumentId] ?? position.entryPrice;
    const cached = positionRowCache.get(position.id);
    if (cached !== undefined && cached.markPrice === markPrice && cached.size === position.size) {
      return cached;
    }
    const row: PositionRowModel = {
      id: position.id,
      instrumentId: position.instrumentId,
      side: position.side,
      size: position.size,
      entryPrice: position.entryPrice,
      markPrice,
      unrealizedPnl: unrealizedPnl(position, markPrice),
    };
    positionRowCache.set(position.id, row);
    return row;
  }),
);

export const selectAccountTotals = createSelector(
  [selectPositions, selectPrices, selectTrades],
  (positions, prices, trades) => {
    let totalPnl = 0;
    let usedRisk = 0;
    for (const position of positions) {
      totalPnl += unrealizedPnl(position, prices[position.instrumentId] ?? position.entryPrice);
      usedRisk += position.riskAmount;
    }
    return { totalPnl, usedRisk, drawdown: maxDrawdown(equityCurve(trades)) };
  },
);

export const selectFilteredTrades = createSelector(
  [selectTrades, selectFilter],
  (trades, filter): Trade[] => trades.filter((trade) => {
    if (filter.strategy !== null && trade.strategy !== filter.strategy) return false;
    if (filter.side !== null && trade.side !== filter.side) return false;
    if (filter.instrumentId !== null && trade.instrumentId !== filter.instrumentId) return false;
    return true;
  }),
);

export const selectJournalRows = createSelector(
  [selectFilteredTrades],
  (trades): JournalRowModel[] => trades
    .slice()
    .sort((a, b) => b.closedAt - a.closedAt)
    .map((trade) => ({
      id: trade.id,
      instrumentId: trade.instrumentId,
      side: trade.side,
      pnl: realizedPnl(trade),
      rMultiple: rMultiple(trade),
      strategy: trade.strategy,
      closedAt: trade.closedAt,
      note: trade.note,
    })),
);

export const selectJournalStats = createSelector(
  [selectFilteredTrades],
  (trades) => ({
    winRate: winRate(trades),
    profitFactor: profitFactor(trades),
    maxDrawdown: maxDrawdown(equityCurve(trades)),
    avgHoldingMs: avgHoldingMs(trades),
    tradeCount: trades.length,
  }),
);

export const selectEquityCurve = createSelector(
  [selectFilteredTrades],
  (trades): EquityPoint[] => equityCurve(trades),
);

export function buildAlertContext(state: RootState, now: number): AlertContext {
  const { positions, prices, trades } = state.app;
  return {
    now,
    dailyPnl: positions.reduce(
      (sum, position) => sum
        + unrealizedPnl(position, prices[position.instrumentId] ?? position.entryPrice),
      0,
    ),
    dailyLossLimit: DAILY_LOSS_LIMIT,
    riskLimitPerTrade: RISK_LIMIT_PER_TRADE,
    recentClosedTrades: [...trades].sort((a, b) => b.closedAt - a.closedAt),
    openPositions: positions.map((position) => ({
      position,
      holdingMs: now - position.openedAt,
    })),
    avgHoldingMs: avgHoldingMs(trades),
  };
}

export function selectAlerts(state: RootState, now: number): Alert[] {
  return evaluateAlerts(buildAlertContext(state, now));
}
