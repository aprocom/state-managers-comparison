import { atom } from 'jotai';
// jotai/utils' atomFamily is deprecated and is removed in Jotai v3; the
// official replacement is this package, same API.
import { atomFamily } from 'jotai-family';
import {
  INSTRUMENTS, START_PRICES, avgHoldingMs, createTradeHistory, equityCurve, evaluateAlerts,
  maxDrawdown, mulberry32, profitFactor, rMultiple, realizedPnl, unrealizedPnl, winRate,
} from '@smc/domain';
import type {
  Alert, AlertContext, EquityPoint, InstrumentId, Position, Quote, Trade,
} from '@smc/domain';
import type {
  InstrumentRowModel, JournalFilter, JournalRowModel, PositionRowModel,
} from '@smc/ui';

export type PriceDirection = 'up' | 'down' | 'flat';
export type Screen = 'terminal' | 'journal';

export const DAILY_LOSS_LIMIT = 400;
export const RISK_LIMIT_PER_TRADE = 100;

export const SEED = 20260729;
export const TRADE_COUNT = 250;
export const NOW = Date.UTC(2026, 6, 29);

const INSTRUMENT_BY_ID = new Map(INSTRUMENTS.map((instrument) => [instrument.id, instrument]));

interface PriceCell {
  price: number;
  direction: PriceDirection;
  seq: number;
}

/**
 * One primitive atom per instrument. Writing a quote touches a single atom, so
 * only the derived atoms that read that atom are invalidated — the atomic
 * model gives per-instrument granularity without any manual bookkeeping.
 */
export const priceAtomFamily = atomFamily((id: InstrumentId) => atom<PriceCell>({
  price: START_PRICES[id] ?? 0,
  direction: 'flat',
  seq: 0,
}));

/** One boolean atom per instrument, so pinning one does not invalidate the
 *  other forty-nine rows. */
export const pinnedAtomFamily = atomFamily((_id: InstrumentId) => atom(false));

/** Derived per instrument, so an untouched instrument keeps its row identity. */
export const instrumentRowAtomFamily = atomFamily((id: InstrumentId) => atom((get): InstrumentRowModel => {
  const cell = get(priceAtomFamily(id));
  const instrument = INSTRUMENT_BY_ID.get(id);
  return {
    id,
    label: instrument === undefined ? id : `${instrument.base}/${instrument.quote}`,
    price: cell.price,
    precision: instrument?.pricePrecision ?? 2,
    changeDirection: cell.direction,
    pinned: get(pinnedAtomFamily(id)),
  };
}));

export const togglePinAtom = atom(null, (get, set, id: InstrumentId) => {
  const pinAtom = pinnedAtomFamily(id);
  set(pinAtom, !get(pinAtom));
});

export const instrumentRowsAtom = atom((get): InstrumentRowModel[] => {
  const rows = INSTRUMENTS.map((instrument) => get(instrumentRowAtomFamily(instrument.id)));
  const pinned = rows.filter((row) => row.pinned);
  return pinned.length === 0 ? rows : [...pinned, ...rows.filter((row) => !row.pinned)];
});

export const pinnedCountAtom = atom((get) => INSTRUMENTS
  .reduce((count, instrument) => count + (get(pinnedAtomFamily(instrument.id)) ? 1 : 0), 0));

export const applyQuoteAtom = atom(null, (get, set, quote: Quote) => {
  const cellAtom = priceAtomFamily(quote.instrumentId);
  const cell = get(cellAtom);
  if (quote.seq <= cell.seq) return;
  if (quote.price === cell.price) {
    set(cellAtom, { ...cell, seq: quote.seq });
    return;
  }
  set(cellAtom, {
    price: quote.price,
    direction: quote.price > cell.price ? 'up' : 'down',
    seq: quote.seq,
  });
});

// --- Base state -------------------------------------------------------------

function seedPositions(seed: number, now: number): Position[] {
  const nextRandom = mulberry32(seed);
  return INSTRUMENTS.slice(0, 6).map((instrument, index) => ({
    id: `pos-${index}`,
    instrumentId: instrument.id,
    side: nextRandom() < 0.6 ? 'long' : 'short',
    size: Number(((200 + nextRandom() * 800) / (START_PRICES[instrument.id] ?? 100)).toFixed(6)),
    entryPrice: START_PRICES[instrument.id] ?? 100,
    openedAt: now - (index === 0 ? 40 * 60 * 60 * 1000 : Math.floor(nextRandom() * 3 * 60 * 60 * 1000)),
    riskAmount: index === 1 ? 150 : Number((20 + nextRandom() * 60).toFixed(2)),
  }));
}

export const positionsAtom = atom<Position[]>(seedPositions(SEED, NOW));
export const tradesAtom = atom<Trade[]>(createTradeHistory(SEED, TRADE_COUNT, NOW));
export const filterAtom = atom<JournalFilter>({ strategy: null, side: null, instrumentId: null });
export const selectedInstrumentIdAtom = atom<InstrumentId | null>(INSTRUMENTS[0]?.id ?? null);
export const feedRateAtom = atom(10);
export const screenAtom = atom<Screen>('terminal');

export const editTradeAtom = atom(
  null,
  (get, set, id: string, patch: { strategy?: string; note?: string }) => {
    set(tradesAtom, get(tradesAtom).map(
      (trade) => (trade.id === id ? { ...trade, ...patch } : trade),
    ));
  },
);

// --- Terminal derivations ---------------------------------------------------

/**
 * Derived per position, for the same reason instrument rows are. Doing it in
 * one atom over the whole array — which is what this file used to do — meant a
 * tick on any position's instrument handed React.memo six new row objects
 * instead of one. The atom graph gives fine-grained invalidation, but only at
 * the granularity you actually build it at; it is not automatic.
 */
export const positionRowAtomFamily = atomFamily((id: string) => atom((get): PositionRowModel | null => {
  const position = get(positionsAtom).find((candidate) => candidate.id === id);
  if (position === undefined) return null;
  const markPrice = get(priceAtomFamily(position.instrumentId)).price;
  return {
    id: position.id,
    instrumentId: position.instrumentId,
    side: position.side,
    size: position.size,
    entryPrice: position.entryPrice,
    markPrice,
    unrealizedPnl: unrealizedPnl(position, markPrice),
  };
}));

export const positionRowsAtom = atom((get): PositionRowModel[] => get(positionsAtom)
  .map((position) => get(positionRowAtomFamily(position.id)))
  .filter((row): row is PositionRowModel => row !== null));

export const accountTotalsAtom = atom((get) => {
  let totalPnl = 0;
  let usedRisk = 0;
  for (const position of get(positionsAtom)) {
    totalPnl += unrealizedPnl(position, get(priceAtomFamily(position.instrumentId)).price);
    usedRisk += position.riskAmount;
  }
  return { totalPnl, usedRisk, drawdown: maxDrawdown(equityCurve(get(tradesAtom))) };
});

// --- Journal derivations ----------------------------------------------------

export const filteredTradesAtom = atom((get): Trade[] => {
  const { strategy, side, instrumentId } = get(filterAtom);
  return get(tradesAtom).filter((trade) => {
    if (strategy !== null && trade.strategy !== strategy) return false;
    if (side !== null && trade.side !== side) return false;
    if (instrumentId !== null && trade.instrumentId !== instrumentId) return false;
    return true;
  });
});

export const journalRowsAtom = atom((get): JournalRowModel[] => get(filteredTradesAtom)
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

export const journalStatsAtom = atom((get) => {
  const trades = get(filteredTradesAtom);
  return {
    winRate: winRate(trades),
    profitFactor: profitFactor(trades),
    maxDrawdown: maxDrawdown(equityCurve(trades)),
    avgHoldingMs: avgHoldingMs(trades),
    tradeCount: trades.length,
  };
});

export const equityCurveAtom = atom((get): EquityPoint[] => equityCurve(get(filteredTradesAtom)));

// --- Alerts -----------------------------------------------------------------

export const alertContextAtom = atom((get): AlertContext => {
  const positions = get(positionsAtom);
  const trades = get(tradesAtom);
  // The frozen clock, not Date.now(). Reading a live clock here made this a
  // derivation whose value changed without any of its inputs changing, so the
  // seeded alert set drifted with the calendar: two alerts on the fixture date,
  // five today, all six positions eventually. All five apps freeze it alike.
  const now = NOW;
  return {
    now,
    dailyPnl: positions.reduce(
      (sum, position) => sum + unrealizedPnl(position, get(priceAtomFamily(position.instrumentId)).price),
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
});

export const alertsAtom = atom((get): Alert[] => evaluateAlerts(get(alertContextAtom)));

export function alertKey(alert: Alert): string {
  return `${alert.kind}:${alert.subjectId}`;
}
