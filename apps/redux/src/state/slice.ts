import {
  configureStore, createEntityAdapter, createListenerMiddleware, createSlice,
} from '@reduxjs/toolkit';
import type { EntityState, PayloadAction } from '@reduxjs/toolkit';
import {
  INSTRUMENTS, START_PRICES, createTradeHistory, mulberry32, nextDirection,
} from '@smc/domain';
import type { InstrumentId, Position, Quote, Trade } from '@smc/domain';
import type { JournalFilter } from '@smc/ui';

export type PriceDirection = 'up' | 'down' | 'flat';
export type Screen = 'terminal' | 'journal';

export const SEED = 20260729;
export const TRADE_COUNT = 250;

/**
 * Frozen at construction. The alert rules read the clock, and evaluating them
 * against a live Date.now() while seeding positions from a fixed date made the
 * alert set drift with the calendar. All five implementations freeze it alike.
 */
export const NOW = Date.UTC(2026, 6, 29);

/**
 * Normalised, because this is what Redux is actually for. Editing a trade used
 * to be a linear scan over 250 array elements; `updateOne` is a keyed write.
 * The `sortComparer` also moves the journal's newest-first ordering into the
 * store, so no selector has to re-sort on every read.
 */
export const tradesAdapter = createEntityAdapter<Trade>({
  sortComparer: (a, b) => b.closedAt - a.closedAt,
});
export const positionsAdapter = createEntityAdapter<Position>();

export interface AppState {
  prices: Record<InstrumentId, number>;
  priceDirections: Record<InstrumentId, PriceDirection>;
  sequences: Record<InstrumentId, number>;
  positions: EntityState<Position, string>;
  trades: EntityState<Trade, string>;
  selectedInstrumentId: InstrumentId | null;
  pinned: InstrumentId[];
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
    positions: positionsAdapter.setAll(
      positionsAdapter.getInitialState(), seedPositions(seed, now),
    ),
    trades: tradesAdapter.setAll(
      tradesAdapter.getInitialState(), createTradeHistory(seed, tradeCount, now),
    ),
    selectedInstrumentId: INSTRUMENTS[0]?.id ?? null,
    pinned: [],
    feedRate: 10,
    screen: 'terminal',
    filter: { strategy: null, side: null, instrumentId: null },
  };
}

/**
 * Immer lets the reducer read like a mutation while still producing a new
 * state object. Note what that costs here: a quote at 1000/s runs the whole
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
      state.priceDirections[quote.instrumentId] = nextDirection(
        previous ?? quote.price, quote.price,
      );
      state.prices[quote.instrumentId] = quote.price;
      state.sequences[quote.instrumentId] = quote.seq;
    },
    instrumentSelected(state, action: PayloadAction<InstrumentId>) {
      state.selectedInstrumentId = action.payload;
    },
    pinToggled(state, action: PayloadAction<InstrumentId>) {
      const index = state.pinned.indexOf(action.payload);
      if (index === -1) state.pinned.push(action.payload);
      else state.pinned.splice(index, 1);
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
      tradesAdapter.updateOne(state.trades, {
        id: action.payload.id,
        changes: action.payload.patch,
      });
    },
  },
});

export const {
  quoteApplied, instrumentSelected, pinToggled, feedRateSet, screenSet, filterSet, tradeEdited,
} = appSlice.actions;

export function createAppStore(preloadedState?: AppState) {
  // One listener-middleware instance per store, as the RTK docs require — a
  // module-level instance would leak listeners between stores in tests.
  const listeners = createListenerMiddleware();
  const store = configureStore({
    reducer: { app: appSlice.reducer },
    ...(preloadedState === undefined ? {} : { preloadedState: { app: preloadedState } }),
    // The dev-only checks re-scan the whole state on every dispatch. RTK already
    // strips them from production builds, so switching them off only changes
    // `npm run dev` — it is here because a 1000/s feed makes the dev experience
    // unusable, not because it flatters the benchmark.
    middleware: (getDefault) => getDefault({
      serializableCheck: false,
      immutableCheck: false,
    }).prepend(listeners.middleware),
  });
  return Object.assign(store, { listeners });
}

export const appStore = createAppStore();

export type RootState = ReturnType<typeof appStore.getState>;
export type AppDispatch = typeof appStore.dispatch;
export type AppStore = ReturnType<typeof createAppStore>;
