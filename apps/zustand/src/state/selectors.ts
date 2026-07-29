import {
  INSTRUMENTS, avgHoldingMs, equityCurve, maxDrawdown, profitFactor,
  rMultiple, realizedPnl, unrealizedPnl, winRate,
} from '@smc/domain';
import type { EquityPoint, InstrumentId, Trade } from '@smc/domain';
import type { InstrumentRowModel, JournalRowModel, PositionRowModel } from '@smc/ui';
import type { AppState } from './store';

const LABELS = new Map(INSTRUMENTS.map((i) => [i.id, `${i.base}/${i.quote}`]));
const PRECISIONS = new Map(INSTRUMENTS.map((i) => [i.id, i.pricePrecision]));

/**
 * What Zustand does and does not give you, stated precisely — an earlier
 * version of this file hand-rolled a memoiser and then billed Zustand for the
 * lines, which measured the author rather than the library.
 *
 * Zustand ships `useShallow` (zustand/react/shallow). It solves reference
 * stability at the subscription: the selector re-runs on every store change,
 * but the component only re-renders when the shallow contents differ. Every
 * call site below uses it, so no selector needs a wrapper to stay stable.
 *
 * What Zustand genuinely does not ship is a derivation cache. `useShallow`
 * compares *after* computing, so an expensive derivation still runs on every
 * store change. Two things follow, and they are the real cost of the
 * minimalism: per-row identity caches (below) so `React.memo` can skip
 * untouched rows, and one explicit memo on the trade filter. MobX computeds
 * and Jotai derived atoms get both from their dependency graph.
 */
function memoizeOne<A extends readonly unknown[], R>(
  compute: (...args: A) => R,
): (...args: A) => R {
  let lastArgs: A | null = null;
  let lastResult: R;
  return (...args: A): R => {
    if (
      lastArgs !== null
      && lastArgs.length === args.length
      && lastArgs.every((value, index) => Object.is(value, args[index]))
    ) {
      return lastResult;
    }
    lastArgs = args;
    lastResult = compute(...args);
    return lastResult;
  };
}

// --- Terminal ---------------------------------------------------------------

const instrumentRowCache = new Map<InstrumentId, InstrumentRowModel>();

export function selectInstrumentRows(state: AppState): InstrumentRowModel[] {
  return INSTRUMENTS.map((instrument) => {
    const price = state.prices[instrument.id] ?? 0;
    const changeDirection = state.priceDirections[instrument.id] ?? 'flat';
    const cached = instrumentRowCache.get(instrument.id);
    // Preserve row identity when nothing about that row moved, so the memoised
    // InstrumentRow only re-renders for instruments that actually ticked.
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
  });
}

const positionRowCache = new Map<string, PositionRowModel>();

export function selectPositionRows(state: AppState): PositionRowModel[] {
  return state.positions.map((position) => {
    const markPrice = state.prices[position.instrumentId] ?? position.entryPrice;
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
  });
}

/** Primitives only, so `useShallow` at the call site is the whole story. */
export function selectAccountTotals(state: AppState): {
  totalPnl: number; usedRisk: number; drawdown: number;
} {
  let totalPnl = 0;
  let usedRisk = 0;
  for (const position of state.positions) {
    totalPnl += unrealizedPnl(position, state.prices[position.instrumentId] ?? position.entryPrice);
    usedRisk += position.riskAmount;
  }
  return { totalPnl, usedRisk, drawdown: maxDrawdown(equityCurve(state.trades)) };
}

// --- Journal ----------------------------------------------------------------

/**
 * The one place an explicit derivation cache earns its keep: filtering 250
 * trades runs on every store change without it, and three separate selectors
 * read the result.
 */
const buildFilteredTrades = memoizeOne((
  trades: AppState['trades'],
  filter: AppState['filter'],
): Trade[] => trades.filter((trade) => {
  if (filter.strategy !== null && trade.strategy !== filter.strategy) return false;
  if (filter.side !== null && trade.side !== filter.side) return false;
  if (filter.instrumentId !== null && trade.instrumentId !== filter.instrumentId) return false;
  return true;
}));

export function selectFilteredTrades(state: AppState): Trade[] {
  return buildFilteredTrades(state.trades, state.filter);
}

/**
 * Derived wholesale, exactly as Redux's `createSelector` does it — the journal
 * has no high-frequency source, so all five implementations rebuild these rows
 * once per filter or edit rather than caching per row.
 */
const buildJournalRows = memoizeOne((trades: Trade[]): JournalRowModel[] => trades
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
  })));

export function selectJournalRows(state: AppState): JournalRowModel[] {
  return buildJournalRows(selectFilteredTrades(state));
}

export function selectJournalStats(state: AppState): {
  winRate: number; profitFactor: number; maxDrawdown: number;
  avgHoldingMs: number; tradeCount: number;
} {
  const trades = selectFilteredTrades(state);
  return {
    winRate: winRate(trades),
    profitFactor: profitFactor(trades),
    maxDrawdown: maxDrawdown(equityCurve(trades)),
    avgHoldingMs: avgHoldingMs(trades),
    tradeCount: trades.length,
  };
}

const buildEquityCurve = memoizeOne((trades: Trade[]): EquityPoint[] => equityCurve(trades));

export function selectEquityCurve(state: AppState): EquityPoint[] {
  return buildEquityCurve(selectFilteredTrades(state));
}
