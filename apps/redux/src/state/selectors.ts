import { createSelector } from 'reselect';
import {
  INSTRUMENTS, avgHoldingMs, equityCurve, evaluateAlerts, maxDrawdown, profitFactor,
  rMultiple, realizedPnl, unrealizedPnl, winRate,
} from '@smc/domain';
import type { Alert, AlertContext, EquityPoint, InstrumentId, Trade } from '@smc/domain';
import type { InstrumentRowModel, JournalRowModel, PositionRowModel } from '@smc/ui';
import type { RootState } from './slice';
import { positionsAdapter, tradesAdapter } from './slice';

export const DAILY_LOSS_LIMIT = 400;
export const RISK_LIMIT_PER_TRADE = 100;

const LABELS = new Map(INSTRUMENTS.map((i) => [i.id, `${i.base}/${i.quote}`]));
const PRECISIONS = new Map(INSTRUMENTS.map((i) => [i.id, i.pricePrecision]));

const selectPrices = (state: RootState) => state.app.prices;
const selectDirections = (state: RootState) => state.app.priceDirections;
const selectFilter = (state: RootState) => state.app.filter;
const selectPinned = (state: RootState) => state.app.pinned;

// The adapters' own selectors. `selectAll` is memoised on the entity state, and
// trades come back newest-first from the adapter's sortComparer, so nothing
// downstream has to re-sort.
const tradeSelectors = tradesAdapter.getSelectors((state: RootState) => state.app.trades);
const positionSelectors = positionsAdapter.getSelectors((state: RootState) => state.app.positions);
const selectTrades = tradeSelectors.selectAll;
const selectPositions = positionSelectors.selectAll;

/**
 * Redux derives nothing on its own, so every view model here is a reselect
 * memoised selector — the same manual derivation layer Zustand needs, just
 * with a library behind it. The per-row identity cache below is likewise hand
 * written; MobX per-instrument computeds and Jotai atom families get it from
 * their dependency graphs instead.
 */
const instrumentRowCache = new Map<InstrumentId, InstrumentRowModel>();

export const selectInstrumentRows = createSelector(
  [selectPrices, selectDirections, selectPinned],
  (prices, directions, pinnedIds): InstrumentRowModel[] => {
    const pinnedSet = new Set(pinnedIds);
    const rows = INSTRUMENTS.map((instrument) => {
      const price = prices[instrument.id] ?? 0;
      const changeDirection = directions[instrument.id] ?? 'flat';
      const isPinned = pinnedSet.has(instrument.id);
      const cached = instrumentRowCache.get(instrument.id);
      if (cached !== undefined
        && cached.price === price
        && cached.changeDirection === changeDirection
        && cached.pinned === isPinned) {
        return cached;
      }
      const row: InstrumentRowModel = {
        id: instrument.id,
        label: LABELS.get(instrument.id) ?? instrument.id,
        price,
        precision: PRECISIONS.get(instrument.id) ?? 2,
        changeDirection,
        pinned: isPinned,
      };
      instrumentRowCache.set(instrument.id, row);
      return row;
    });
    const pinned = rows.filter((row) => row.pinned);
    return pinned.length === 0 ? rows : [...pinned, ...rows.filter((row) => !row.pinned)];
  },
);

export const selectPinnedCount = createSelector([selectPinned], (pinned) => pinned.length);

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

/**
 * Its own selector, so it is cached on the trades array rather than recomputed
 * whenever a price moves. Composed inline below, it turned a 250-element copy,
 * sort and scan into hot-path work on every one of a thousand quotes a second.
 * This is what `createSelector` composition is for and the earlier version
 * simply did not use it.
 */
export const selectDrawdown = createSelector(
  [selectTrades],
  (trades) => maxDrawdown(equityCurve(trades)),
);

export const selectAccountTotals = createSelector(
  [selectPositions, selectPrices, selectDrawdown],
  (positions, prices, drawdown) => {
    let totalPnl = 0;
    let usedRisk = 0;
    for (const position of positions) {
      totalPnl += unrealizedPnl(position, prices[position.instrumentId] ?? position.entryPrice);
      usedRisk += position.riskAmount;
    }
    return { totalPnl, usedRisk, drawdown };
  },
);

/** The instruments the alert rules actually read a price for. */
export const selectHeldInstrumentIds = createSelector(
  [selectPositions],
  (positions) => positions.map((position) => position.instrumentId),
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
  // Already newest-first from the adapter's sortComparer.
  (trades): JournalRowModel[] => trades
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
  const { prices } = state.app;
  const positions = selectPositions(state);
  const trades = selectTrades(state);
  return {
    now,
    dailyPnl: positions.reduce(
      (sum, position) => sum
        + unrealizedPnl(position, prices[position.instrumentId] ?? position.entryPrice),
      0,
    ),
    dailyLossLimit: DAILY_LOSS_LIMIT,
    riskLimitPerTrade: RISK_LIMIT_PER_TRADE,
    recentClosedTrades: trades,
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
