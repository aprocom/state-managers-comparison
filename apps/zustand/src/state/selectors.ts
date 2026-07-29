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
 * Zustand v5 reads through useSyncExternalStore, which demands a stable
 * reference from every selector. Nothing in the library derives or caches for
 * us, so each selector below carries its own hand-rolled memo. This file is
 * the honest cost of Zustand's minimalism, and the comparison should quote it
 * as such — MobX computeds and Jotai derived atoms get the same behaviour for
 * free.
 */
function memoizeOne<A extends readonly unknown[], R>(
  compute: (...args: A) => R,
): (...args: A) => R {
  let lastArgs: A | null = null;
  let lastResult: R;
  return (...args: A): R => {
    if (
      lastArgs !== null &&
      lastArgs.length === args.length &&
      lastArgs.every((value, index) => Object.is(value, args[index]))
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

const buildInstrumentRows = memoizeOne((
  prices: AppState['prices'],
  directions: AppState['priceDirections'],
): InstrumentRowModel[] => INSTRUMENTS.map((instrument) => {
  const price = prices[instrument.id] ?? 0;
  const changeDirection = directions[instrument.id] ?? 'flat';
  const cached = instrumentRowCache.get(instrument.id);
  // Preserve row identity when nothing about that row moved, so the memoised
  // InstrumentRow only re-renders for instruments that actually ticked.
  if (cached !== undefined && cached.price === price && cached.changeDirection === changeDirection) {
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
}));

export function selectInstrumentRows(state: AppState): InstrumentRowModel[] {
  return buildInstrumentRows(state.prices, state.priceDirections);
}

const positionRowCache = new Map<string, PositionRowModel>();

const buildPositionRows = memoizeOne((
  positions: AppState['positions'],
  prices: AppState['prices'],
): PositionRowModel[] => positions.map((position) => {
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
}));

export function selectPositionRows(state: AppState): PositionRowModel[] {
  return buildPositionRows(state.positions, state.prices);
}

const buildAccountTotals = memoizeOne((
  positions: AppState['positions'],
  prices: AppState['prices'],
  trades: AppState['trades'],
) => {
  let totalPnl = 0;
  let usedRisk = 0;
  for (const position of positions) {
    totalPnl += unrealizedPnl(position, prices[position.instrumentId] ?? position.entryPrice);
    usedRisk += position.riskAmount;
  }
  return { totalPnl, usedRisk, drawdown: maxDrawdown(equityCurve(trades)) };
});

export function selectAccountTotals(state: AppState): {
  totalPnl: number; usedRisk: number; drawdown: number;
} {
  return buildAccountTotals(state.positions, state.prices, state.trades);
}

// --- Journal ----------------------------------------------------------------

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

const buildJournalStats = memoizeOne((trades: Trade[]) => ({
  winRate: winRate(trades),
  profitFactor: profitFactor(trades),
  maxDrawdown: maxDrawdown(equityCurve(trades)),
  avgHoldingMs: avgHoldingMs(trades),
  tradeCount: trades.length,
}));

export function selectJournalStats(state: AppState): {
  winRate: number; profitFactor: number; maxDrawdown: number;
  avgHoldingMs: number; tradeCount: number;
} {
  return buildJournalStats(selectFilteredTrades(state));
}

const buildEquityCurve = memoizeOne((trades: Trade[]): EquityPoint[] => equityCurve(trades));

export function selectEquityCurve(state: AppState): EquityPoint[] {
  return buildEquityCurve(selectFilteredTrades(state));
}
