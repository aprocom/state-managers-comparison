import { configureStore, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { INSTRUMENTS, START_PRICES, createTradeHistory, mulberry32 } from '@smc/domain';
import type { InstrumentId, Position, Quote, Trade } from '@smc/domain';
import type { JournalFilter } from '@smc/ui';

export type PriceDirection = 'up' | 'down' | 'flat';
export type Screen = 'terminal' | 'journal';

export const SEED = 20260729;
export const TRADE_COUNT = 250;
export const NOW = Date.UTC(2026, 6, 29);

export interface AppState {
  prices: Record<InstrumentId, number>;
  priceDirections: Record<InstrumentId, PriceDirection>;
  sequences: Record<InstrumentId, number>;
  positions: Position[];
  trades: Trade[];
  selectedInstrumentId: InstrumentId | null;
  feedRate: number;
  screen: Screen;
  filter: JournalFilter;
}

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

export function createInitialState(
  seed = SEED, tradeCount = TRADE_COUNT, now = NOW,
): AppState {
  return {
    prices: { ...START_PRICES },
    priceDirections: {},
    sequences: {},
    positions: seedPositions(seed, now),
    trades: createTradeHistory(seed, tradeCount, now),
    selectedInstrumentId: INSTRUMENTS[0]?.id ?? null,
    feedRate: 10,
    screen: 'terminal',
    filter: { strategy: null, side: null, instrumentId: null },
  };
}

/**
 * Immer lets the reducer read like a mutation while still producing a new
 * state object. Note what that costs here: a quote at 100/s runs the whole
 * draft-and-finalise cycle, and every derived value has to be rebuilt by a
 * reselect selector because the store itself derives nothing.
 */
const appSlice = createSlice({
  name: 'app',
  initialState: createInitialState(),
  reducers: {
    quoteApplied(state, action: PayloadAction<Quote>) {
      const quote = action.payload;
      if (quote.seq <= (state.sequences[quote.instrumentId] ?? 0)) return;
      const previous = state.prices[quote.instrumentId];
      state.priceDirections[quote.instrumentId] =
        previous === undefined || previous === quote.price
          ? 'flat'
          : quote.price > previous ? 'up' : 'down';
      state.prices[quote.instrumentId] = quote.price;
      state.sequences[quote.instrumentId] = quote.seq;
    },
    instrumentSelected(state, action: PayloadAction<InstrumentId>) {
      state.selectedInstrumentId = action.payload;
    },
    feedRateSet(state, action: PayloadAction<number>) {
      state.feedRate = action.payload;
    },
    screenSet(state, action: PayloadAction<Screen>) {
      state.screen = action.payload;
    },
    filterSet(state, action: PayloadAction<JournalFilter>) {
      state.filter = action.payload;
    },
    tradeEdited(
      state,
      action: PayloadAction<{ id: string; patch: { strategy?: string; note?: string } }>,
    ) {
      const trade = state.trades.find((candidate) => candidate.id === action.payload.id);
      if (trade === undefined) return;
      Object.assign(trade, action.payload.patch);
    },
  },
});

export const {
  quoteApplied, instrumentSelected, feedRateSet, screenSet, filterSet, tradeEdited,
} = appSlice.actions;

export function createAppStore(preloadedState?: AppState) {
  return configureStore({
    reducer: { app: appSlice.reducer },
    ...(preloadedState === undefined ? {} : { preloadedState: { app: preloadedState } }),
    middleware: (getDefault) => getDefault({
      // 250 trades and 50 prices are re-scanned by these checks on every
      // dispatch. At 100 quotes per second that dominates the profile, so they
      // are off here exactly as they would be in a real high-frequency app.
      serializableCheck: false,
      immutableCheck: false,
    }),
  });
}

export const appStore = createAppStore();

export type RootState = ReturnType<typeof appStore.getState>;
export type AppDispatch = typeof appStore.dispatch;
