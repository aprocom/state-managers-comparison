import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  nextDirection,
  INSTRUMENTS, START_PRICES, createTradeHistory, mulberry32,
} from '@smc/domain';
import type { Alert, InstrumentId, Position, Quote, Trade } from '@smc/domain';
import type { JournalFilter } from '@smc/ui';

export type PriceDirection = 'up' | 'down' | 'flat';
export type Screen = 'terminal' | 'journal';

export interface AppState {
  prices: Record<InstrumentId, number>;
  priceDirections: Record<InstrumentId, PriceDirection>;
  sequences: Record<InstrumentId, number>;
  positions: Position[];
  trades: Trade[];
  selectedInstrumentId: InstrumentId | null;
  pinned: InstrumentId[];
  feedRate: number;
  screen: Screen;
  filter: JournalFilter;
  alerts: Alert[];

  applyQuote(quote: Quote): void;
  selectInstrument(id: InstrumentId): void;
  togglePin(id: InstrumentId): void;
  setFeedRate(rate: number): void;
  setScreen(screen: Screen): void;
  setFilter(filter: JournalFilter): void;
  editTrade(id: string, patch: { strategy?: string; note?: string }): void;
  setAlerts(alerts: Alert[]): void;
}

export interface StoreOptions {
  seed: number;
  tradeCount: number;
  now: number;
}

function seedPositions(seed: number, now: number): Position[] {
  const nextRandom = mulberry32(seed);
  return INSTRUMENTS.slice(0, 6).map((instrument, index) => ({
    id: `pos-${index}`,
    instrumentId: instrument.id,
    side: nextRandom() < 0.6 ? 'long' : 'short',
    size: Number(((200 + nextRandom() * 800) / (START_PRICES[instrument.id] ?? 100)).toFixed(6)),
    entryPrice: START_PRICES[instrument.id] ?? 100,
    // One position is deliberately long-held so the time-in-trade alert has a subject.
    openedAt: now - (index === 0 ? 40 * 60 * 60 * 1000 : Math.floor(nextRandom() * 3 * 60 * 60 * 1000)),
    // One position deliberately breaches the per-trade risk limit.
    riskAmount: index === 1 ? 150 : Number((20 + nextRandom() * 60).toFixed(2)),
  }));
}

/**
 * Frozen at construction. The alert rules read the clock, and evaluating them
 * against a live Date.now() while seeding positions from a fixed date made the
 * alert set drift with the calendar. All five implementations freeze it alike.
 */
export const NOW = Date.UTC(2026, 6, 29);

export function createAppStore(options: StoreOptions) {
  // subscribeWithSelector lets the alert engine watch only the slices it reads
  // instead of every store write. It ships with Zustand; hand-rolling the same
  // thing and then billing Zustand for the lines would be measuring me.
  return create<AppState>()(subscribeWithSelector((set, get) => ({
    prices: { ...START_PRICES },
    priceDirections: {},
    sequences: {},
    positions: seedPositions(options.seed, options.now),
    trades: createTradeHistory(options.seed, options.tradeCount, options.now),
    selectedInstrumentId: INSTRUMENTS[0]?.id ?? null,
    pinned: [],
    feedRate: 10,
    screen: 'terminal',
    filter: { strategy: null, side: null, instrumentId: null },
    alerts: [],

    applyQuote(quote) {
      const state = get();
      const lastSeq = state.sequences[quote.instrumentId] ?? 0;
      if (quote.seq <= lastSeq) return;

      const previous = state.prices[quote.instrumentId];
      const direction = nextDirection(previous ?? quote.price, quote.price);

      set({
        prices: { ...state.prices, [quote.instrumentId]: quote.price },
        priceDirections: { ...state.priceDirections, [quote.instrumentId]: direction },
        sequences: { ...state.sequences, [quote.instrumentId]: quote.seq },
      });
    },

    selectInstrument(id) { set({ selectedInstrumentId: id }); },
    togglePin(id) {
      const { pinned } = get();
      set({
        pinned: pinned.includes(id) ? pinned.filter((other) => other !== id) : [...pinned, id],
      });
    },
    setFeedRate(rate) { set({ feedRate: rate }); },
    setScreen(screen) { set({ screen }); },
    setFilter(filter) { set({ filter }); },

    editTrade(id, patch) {
      set({
        trades: get().trades.map((trade) => (trade.id === id ? { ...trade, ...patch } : trade)),
      });
    },

    setAlerts(alerts) { set({ alerts }); },
  })));
}

export const useAppStore = createAppStore({
  seed: 20260729,
  tradeCount: 250,
  now: NOW,
});

/** Same store, named for non-hook consumers such as the alert engine. */
export const appStore = useAppStore;
