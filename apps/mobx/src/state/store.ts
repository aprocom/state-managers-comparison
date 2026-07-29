import { computed, makeObservable, observable, action, reaction } from 'mobx';
import {
  nextDirection,
  INSTRUMENTS, START_PRICES, avgHoldingMs, createTradeHistory, equityCurve, evaluateAlerts,
  maxDrawdown, mulberry32, profitFactor, rMultiple, realizedPnl, unrealizedPnl, winRate,
} from '@smc/domain';
import type {
  Alert, AlertContext, EquityPoint, Instrument, InstrumentId, Position, Quote, Trade,
} from '@smc/domain';
import type {
  InstrumentRowModel, JournalFilter, JournalRowModel, PositionRowModel,
} from '@smc/ui';

export type PriceDirection = 'up' | 'down' | 'flat';
export type Screen = 'terminal' | 'journal';

export const DAILY_LOSS_LIMIT = 400;
export const RISK_LIMIT_PER_TRADE = 100;

/**
 * One observable per instrument, each with its own computed row. MobX caches a
 * computed until its own dependencies change, so a tick on BTC invalidates
 * exactly one row and leaves the other forty-nine references untouched. This
 * is the identity preservation that Zustand needs a hand-written cache for.
 */
class InstrumentModel {
  price: number;
  direction: PriceDirection = 'flat';
  pinned = false;
  private seq = 0;

  constructor(private readonly instrument: Instrument) {
    this.price = START_PRICES[instrument.id] ?? 0;
    makeObservable<InstrumentModel, 'seq'>(this, {
      price: observable,
      direction: observable,
      pinned: observable,
      seq: observable,
      row: computed,
      applyQuote: action,
      togglePin: action,
    });
  }

  togglePin(): void {
    this.pinned = !this.pinned;
  }

  get id(): InstrumentId {
    return this.instrument.id;
  }

  applyQuote(quote: Quote): void {
    if (quote.seq <= this.seq) return;
    this.seq = quote.seq;
    this.direction = nextDirection(this.price, quote.price);
    this.price = quote.price;
  }

  get row(): InstrumentRowModel {
    return {
      id: this.instrument.id,
      label: `${this.instrument.base}/${this.instrument.quote}`,
      price: this.price,
      precision: this.instrument.pricePrecision,
      changeDirection: this.direction,
      pinned: this.pinned,
    };
  }
}

/**
 * The mirror of InstrumentModel for open positions, and the fix for a bug this
 * project shipped and published: `positionRows` used to be a single store-level
 * computed that rebuilt all six row objects whenever any watched price changed.
 * It read as idiomatic MobX and cost six row renders per tick instead of one.
 * Putting the computed on the position puts the invalidation boundary where the
 * data boundary already is.
 */
class PositionModel {
  constructor(
    readonly position: Position,
    private readonly instrument: InstrumentModel | undefined,
  ) {
    makeObservable(this, { row: computed, markPrice: computed });
  }

  get markPrice(): number {
    return this.instrument?.price ?? this.position.entryPrice;
  }

  get row(): PositionRowModel {
    const { markPrice } = this;
    return {
      id: this.position.id,
      instrumentId: this.position.instrumentId,
      side: this.position.side,
      size: this.position.size,
      entryPrice: this.position.entryPrice,
      markPrice,
      unrealizedPnl: unrealizedPnl(this.position, markPrice),
    };
  }
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
    openedAt: now - (index === 0 ? 40 * 60 * 60 * 1000 : Math.floor(nextRandom() * 3 * 60 * 60 * 1000)),
    riskAmount: index === 1 ? 150 : Number((20 + nextRandom() * 60).toFixed(2)),
  }));
}

export class AppStore {
  readonly instruments: InstrumentModel[] = INSTRUMENTS.map((i) => new InstrumentModel(i));
  private readonly modelsById = new Map<InstrumentId, InstrumentModel>();

  private readonly positionModels: PositionModel[];

  /**
   * Frozen at construction, and deliberately so. The alert rules read the clock
   * (time-in-trade, the tilt window), and reading a live `Date.now()` from a
   * computed makes it impure: its cache goes stale on a schedule MobX cannot
   * see, and the same app produces different alerts depending on the day you
   * open it. All five implementations freeze it the same way.
   */
  readonly now: number;

  positions: Position[];
  trades: Trade[];
  selectedInstrumentId: InstrumentId | null = INSTRUMENTS[0]?.id ?? null;
  feedRate = 10;
  screen: Screen = 'terminal';
  filter: JournalFilter = { strategy: null, side: null, instrumentId: null };

  constructor(options: StoreOptions) {
    this.now = options.now;
    this.positions = seedPositions(options.seed, options.now);
    this.trades = createTradeHistory(options.seed, options.tradeCount, options.now);
    for (const model of this.instruments) this.modelsById.set(model.id, model);
    this.positionModels = this.positions.map(
      (position) => new PositionModel(position, this.modelsById.get(position.instrumentId)),
    );

    makeObservable(this, {
      // `.ref` because both arrays are only ever replaced wholesale. Deep
      // observability would proxy-wrap 250 trade objects to track mutations
      // that never happen.
      positions: observable.ref,
      trades: observable.ref,
      selectedInstrumentId: observable,
      feedRate: observable,
      screen: observable,
      filter: observable,

      instrumentRows: computed,
      pinnedCount: computed,
      positionRows: computed,
      sortedTrades: computed,
      drawdown: computed,
      accountTotals: computed,
      filteredTrades: computed,
      journalRows: computed,
      journalStats: computed,
      equityCurve: computed,
      alerts: computed,

      applyQuote: action,
      selectInstrument: action,
      togglePin: action,
      setFeedRate: action,
      setScreen: action,
      setFilter: action,
      editTrade: action,
    });
  }

  // --- Actions ---------------------------------------------------------------

  applyQuote(quote: Quote): void {
    this.modelsById.get(quote.instrumentId)?.applyQuote(quote);
  }

  selectInstrument(id: InstrumentId): void { this.selectedInstrumentId = id; }

  togglePin(id: InstrumentId): void { this.modelsById.get(id)?.togglePin(); }
  setFeedRate(rate: number): void { this.feedRate = rate; }
  setScreen(screen: Screen): void { this.screen = screen; }
  setFilter(filter: JournalFilter): void { this.filter = filter; }

  editTrade(id: string, patch: { strategy?: string; note?: string }): void {
    this.trades = this.trades.map((trade) => (trade.id === id ? { ...trade, ...patch } : trade));
  }

  // --- Derived state ---------------------------------------------------------

  get instrumentRows(): InstrumentRowModel[] {
    const rows = this.instruments.map((model) => model.row);
    const pinned = rows.filter((row) => row.pinned);
    return pinned.length === 0 ? rows : [...pinned, ...rows.filter((row) => !row.pinned)];
  }

  get pinnedCount(): number {
    return this.instruments.reduce((count, model) => count + (model.pinned ? 1 : 0), 0);
  }

  private priceOf(instrumentId: InstrumentId, fallback: number): number {
    return this.modelsById.get(instrumentId)?.price ?? fallback;
  }

  get positionRows(): PositionRowModel[] {
    return this.positionModels.map((model) => model.row);
  }

  /** Newest-first, cached on the trades array — the ordering Redux's entity
   *  adapter keeps in the store for free. */
  get sortedTrades(): Trade[] {
    return [...this.trades].sort((a, b) => b.closedAt - a.closedAt);
  }

  /** Depends only on closed trades, so it survives every price tick. */
  get drawdown(): number {
    return maxDrawdown(equityCurve(this.trades));
  }

  get accountTotals(): { totalPnl: number; usedRisk: number; drawdown: number } {
    let totalPnl = 0;
    let usedRisk = 0;
    for (const position of this.positions) {
      totalPnl += unrealizedPnl(position, this.priceOf(position.instrumentId, position.entryPrice));
      usedRisk += position.riskAmount;
    }
    return { totalPnl, usedRisk, drawdown: this.drawdown };
  }

  get filteredTrades(): Trade[] {
    const { strategy, side, instrumentId } = this.filter;
    return this.trades.filter((trade) => {
      if (strategy !== null && trade.strategy !== strategy) return false;
      if (side !== null && trade.side !== side) return false;
      if (instrumentId !== null && trade.instrumentId !== instrumentId) return false;
      return true;
    });
  }

  get journalRows(): JournalRowModel[] {
    return this.filteredTrades
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
      }));
  }

  get journalStats(): {
    winRate: number; profitFactor: number; maxDrawdown: number;
    avgHoldingMs: number; tradeCount: number;
  } {
    const trades = this.filteredTrades;
    return {
      winRate: winRate(trades),
      profitFactor: profitFactor(trades),
      maxDrawdown: maxDrawdown(equityCurve(trades)),
      avgHoldingMs: avgHoldingMs(trades),
      tradeCount: trades.length,
    };
  }

  get equityCurve(): EquityPoint[] {
    return equityCurve(this.filteredTrades);
  }

  buildAlertContext(now: number): AlertContext {
    return {
      now,
      dailyPnl: this.positions.reduce(
        (sum, position) => sum
          + unrealizedPnl(position, this.priceOf(position.instrumentId, position.entryPrice)),
        0,
      ),
      dailyLossLimit: DAILY_LOSS_LIMIT,
      riskLimitPerTrade: RISK_LIMIT_PER_TRADE,
      recentClosedTrades: this.sortedTrades,
      openPositions: this.positions.map((position) => ({
        position,
        holdingMs: now - position.openedAt,
      })),
      avgHoldingMs: avgHoldingMs(this.trades),
    };
  }

  /**
   * A plain computed, and a pure one: every input is either observable or the
   * frozen clock. MobX recomputes it only when something it actually read
   * changes, which is what makes the `reaction` below cheap enough to run on a
   * 1000/s feed. It does not make the reaction bookkeeping-free: fire-once
   * notification still needs the key Set in `attachAlertEngine`, because a
   * reaction fires on *any* change to the alert set and an alert that was
   * already fired must not fire again.
   */
  get alerts(): Alert[] {
    return evaluateAlerts(this.buildAlertContext(this.now));
  }
}

export function alertKeys(alerts: Alert[]): string {
  return alerts.map((alert) => `${alert.kind}:${alert.subjectId}`).sort().join('|');
}

export function attachAlertEngine(
  store: AppStore,
  onFire: (alert: Alert) => void,
): () => void {
  let firedKeys = new Set<string>();
  return reaction(
    () => alertKeys(store.alerts),
    () => {
      const alerts = store.alerts;
      const keys = new Set(alerts.map((alert) => `${alert.kind}:${alert.subjectId}`));
      for (const alert of alerts) {
        if (!firedKeys.has(`${alert.kind}:${alert.subjectId}`)) onFire(alert);
      }
      firedKeys = keys;
    },
    { fireImmediately: true },
  );
}

export const appStore = new AppStore({
  seed: 20260729,
  tradeCount: 250,
  now: Date.UTC(2026, 6, 29),
});
