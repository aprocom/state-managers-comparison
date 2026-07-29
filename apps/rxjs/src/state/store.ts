import {
  BehaviorSubject, Subject, Subscription, combineLatest, map, scan, shareReplay, startWith,
} from 'rxjs';
import type { Observable } from 'rxjs';
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

const INDEX_BY_ID = new Map(INSTRUMENTS.map((instrument, index) => [instrument.id, index]));

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
    openedAt: now - (index === 0 ? 40 * 60 * 60 * 1000 : Math.floor(nextRandom() * 3 * 60 * 60 * 1000)),
    riskAmount: index === 1 ? 150 : Number((20 + nextRandom() * 60).toFixed(2)),
  }));
}

function initialInstrumentRows(): InstrumentRowModel[] {
  return INSTRUMENTS.map((instrument) => ({
    id: instrument.id,
    label: `${instrument.base}/${instrument.quote}`,
    price: START_PRICES[instrument.id] ?? 0,
    precision: instrument.pricePrecision,
    changeDirection: 'flat' as PriceDirection,
  }));
}

interface PriceState {
  prices: Record<InstrumentId, number>;
  sequences: Record<InstrumentId, number>;
}

export interface AppStore {
  readonly instrumentRows$: BehaviorSubject<InstrumentRowModel[]>;
  readonly positionRows$: BehaviorSubject<PositionRowModel[]>;
  readonly accountTotals$: BehaviorSubject<{ totalPnl: number; usedRisk: number; drawdown: number }>;
  readonly alerts$: BehaviorSubject<Alert[]>;
  readonly journalRows$: BehaviorSubject<JournalRowModel[]>;
  readonly journalStats$: BehaviorSubject<{
    winRate: number; profitFactor: number; maxDrawdown: number;
    avgHoldingMs: number; tradeCount: number;
  }>;
  readonly equityCurve$: BehaviorSubject<EquityPoint[]>;
  readonly selectedInstrumentId$: BehaviorSubject<InstrumentId | null>;
  readonly feedRate$: BehaviorSubject<number>;
  readonly screen$: BehaviorSubject<Screen>;
  readonly filter$: BehaviorSubject<JournalFilter>;

  applyQuote(quote: Quote): void;
  selectInstrument(id: InstrumentId): void;
  setFeedRate(rate: number): void;
  setScreen(screen: Screen): void;
  setFilter(filter: JournalFilter): void;
  editTrade(id: string, patch: { strategy?: string; note?: string }): void;
  onAlertFired(listener: (alert: Alert) => void): () => void;
  destroy(): void;
}

/**
 * Materialise a derived observable into a BehaviorSubject so React can read a
 * synchronous snapshot through useSyncExternalStore. Bridging push-based RxJS
 * to React's pull-based reads is a real cost of this approach and is counted
 * as such in the comparison.
 */
function connect<T>(source: Observable<T>, seed: T, sink: Subscription): BehaviorSubject<T> {
  const subject = new BehaviorSubject<T>(seed);
  sink.add(source.subscribe((value) => subject.next(value)));
  return subject;
}

export function createAppStore(options: StoreOptions): AppStore {
  const subscriptions = new Subscription();

  const quotes$ = new Subject<Quote>();
  const positionsSource$ = new BehaviorSubject<Position[]>(seedPositions(options.seed, options.now));
  const tradesSource$ = new BehaviorSubject<Trade[]>(
    createTradeHistory(options.seed, options.tradeCount, options.now),
  );
  const filterSource$ = new BehaviorSubject<JournalFilter>({
    strategy: null, side: null, instrumentId: null,
  });
  const selectedInstrumentId$ = new BehaviorSubject<InstrumentId | null>(INSTRUMENTS[0]?.id ?? null);
  const feedRate$ = new BehaviorSubject<number>(10);
  const screen$ = new BehaviorSubject<Screen>('terminal');
  const alertListeners = new Set<(alert: Alert) => void>();

  const emptyPriceState: PriceState = { prices: { ...START_PRICES }, sequences: {} };
  // One array, shared by the scan seed, the startWith and the connect seed.
  // Building it three times would hand out three distinct row objects per
  // instrument and silently destroy the identity that memoised rows rely on.
  const initialRows = initialInstrumentRows();

  const priceState$ = quotes$.pipe(
    scan((state: PriceState, quote: Quote) => {
      if (quote.seq <= (state.sequences[quote.instrumentId] ?? 0)) return state;
      return {
        prices: { ...state.prices, [quote.instrumentId]: quote.price },
        sequences: { ...state.sequences, [quote.instrumentId]: quote.seq },
      };
    }, emptyPriceState),
    startWith(emptyPriceState),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Rows are derived incrementally: `scan` rewrites only the row that ticked
   * and leaves every other row's identity untouched, so the memoised row
   * component re-renders for one instrument instead of fifty. No hand-written
   * cache is needed — the operator does it.
   */
  const instrumentRows$ = quotes$.pipe(
    scan((rows: InstrumentRowModel[], quote: Quote) => {
      const index = INDEX_BY_ID.get(quote.instrumentId);
      if (index === undefined) return rows;
      const current = rows[index];
      if (current === undefined || current.price === quote.price) return rows;
      const next = rows.slice();
      next[index] = {
        ...current,
        price: quote.price,
        changeDirection: quote.price > current.price ? 'up' : 'down',
      };
      return next;
    }, initialRows),
    startWith(initialRows),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  const positionRowCache = new Map<string, PositionRowModel>();
  const positionRows$ = combineLatest([positionsSource$, priceState$]).pipe(
    map(([positions, priceState]) => positions.map((position) => {
      const markPrice = priceState.prices[position.instrumentId] ?? position.entryPrice;
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
    })),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  const accountTotals$ = combineLatest([positionsSource$, priceState$, tradesSource$]).pipe(
    map(([positions, priceState, trades]) => {
      let totalPnl = 0;
      let usedRisk = 0;
      for (const position of positions) {
        totalPnl += unrealizedPnl(
          position,
          priceState.prices[position.instrumentId] ?? position.entryPrice,
        );
        usedRisk += position.riskAmount;
      }
      return { totalPnl, usedRisk, drawdown: maxDrawdown(equityCurve(trades)) };
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  // --- Journal ---------------------------------------------------------------

  const filteredTrades$ = combineLatest([tradesSource$, filterSource$]).pipe(
    map(([trades, filter]) => trades.filter((trade) => {
      if (filter.strategy !== null && trade.strategy !== filter.strategy) return false;
      if (filter.side !== null && trade.side !== filter.side) return false;
      if (filter.instrumentId !== null && trade.instrumentId !== filter.instrumentId) return false;
      return true;
    })),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  const journalRows$ = filteredTrades$.pipe(
    map((trades) => trades
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
      }))),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  const journalStats$ = filteredTrades$.pipe(
    map((trades) => ({
      winRate: winRate(trades),
      profitFactor: profitFactor(trades),
      maxDrawdown: maxDrawdown(equityCurve(trades)),
      avgHoldingMs: avgHoldingMs(trades),
      tradeCount: trades.length,
    })),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  const equityCurve$ = filteredTrades$.pipe(
    map((trades) => equityCurve(trades)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  // --- Alerts ----------------------------------------------------------------

  const alertContext$ = combineLatest([positionsSource$, priceState$, tradesSource$]).pipe(
    map(([positions, priceState, trades]): AlertContext => {
      const now = Date.now();
      return {
        now,
        dailyPnl: positions.reduce(
          (sum, position) => sum + unrealizedPnl(
            position,
            priceState.prices[position.instrumentId] ?? position.entryPrice,
          ),
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
    }),
  );

  /**
   * Firing once per transition falls out of the pipeline: `scan` carries the
   * previous key set and emits only what is newly triggered. Zustand needs a
   * hand-maintained Set for the same guarantee — this is the clearest single
   * illustration of what a stream model buys you.
   */
  const alerts$ = alertContext$.pipe(
    map(evaluateAlerts),
    scan(
      (previous: { alerts: Alert[]; keys: Set<string>; fired: Alert[] }, alerts: Alert[]) => {
        const keys = new Set(alerts.map((alert) => `${alert.kind}:${alert.subjectId}`));
        const fired = alerts.filter(
          (alert) => !previous.keys.has(`${alert.kind}:${alert.subjectId}`),
        );
        const unchanged =
          previous.alerts.length === alerts.length &&
          previous.alerts.every((alert, index) => {
            const next = alerts[index];
            return next !== undefined
              && alert.kind === next.kind
              && alert.subjectId === next.subjectId;
          });
        return { alerts: unchanged ? previous.alerts : alerts, keys, fired };
      },
      { alerts: [] as Alert[], keys: new Set<string>(), fired: [] as Alert[] },
    ),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  subscriptions.add(alerts$.subscribe(({ fired }) => {
    for (const alert of fired) {
      for (const listener of alertListeners) listener(alert);
    }
  }));

  const store: AppStore = {
    instrumentRows$: connect(instrumentRows$, initialRows, subscriptions),
    positionRows$: connect(positionRows$, [], subscriptions),
    accountTotals$: connect(
      accountTotals$, { totalPnl: 0, usedRisk: 0, drawdown: 0 }, subscriptions,
    ),
    alerts$: connect(alerts$.pipe(map(({ alerts }) => alerts)), [], subscriptions),
    journalRows$: connect(journalRows$, [], subscriptions),
    journalStats$: connect(
      journalStats$,
      { winRate: 0, profitFactor: 0, maxDrawdown: 0, avgHoldingMs: 0, tradeCount: 0 },
      subscriptions,
    ),
    equityCurve$: connect(equityCurve$, [], subscriptions),
    selectedInstrumentId$,
    feedRate$,
    screen$,
    filter$: filterSource$,

    applyQuote(quote) { quotes$.next(quote); },
    selectInstrument(id) { selectedInstrumentId$.next(id); },
    setFeedRate(rate) { feedRate$.next(rate); },
    setScreen(screen) { screen$.next(screen); },
    setFilter(filter) { filterSource$.next(filter); },
    editTrade(id, patch) {
      tradesSource$.next(
        tradesSource$.getValue().map((trade) => (trade.id === id ? { ...trade, ...patch } : trade)),
      );
    },
    onAlertFired(listener) {
      alertListeners.add(listener);
      return () => { alertListeners.delete(listener); };
    },
    destroy() {
      subscriptions.unsubscribe();
      quotes$.complete();
    },
  };

  return store;
}

export const appStore = createAppStore({
  seed: 20260729,
  tradeCount: 250,
  now: Date.UTC(2026, 6, 29),
});
