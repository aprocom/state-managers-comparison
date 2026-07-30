import {
  DAILY_LOSS_LIMIT, RISK_LIMIT_PER_TRADE, alertKey, avgHoldingMs, evaluateAlerts, unrealizedPnl,
} from '@smc/domain';
import type { Alert, AlertContext } from '@smc/domain';
import type { AppState, createAppStore } from './store';
import { selectHeldPrices } from './selectors';
import { memoizeOne } from './utils';

/**
 * Sorting 250 trades on every alert evaluation was work Redux did not do — its
 * entity adapter keeps them newest-first in the store. Memoising it here puts
 * all five on the same footing; the residual difference is where the ordering
 * lives, not how often it is computed.
 */
const sortedTrades = memoizeOne(
  (trades: AppState['trades']) => [...trades].sort((a, b) => b.closedAt - a.closedAt),
);

export function buildAlertContext(state: AppState, now: number): AlertContext {
  const dailyPnl = state.positions.reduce(
    (sum, position) => sum + unrealizedPnl(position, state.prices[position.instrumentId] ?? position.entryPrice),
    0,
  );

  return {
    now,
    dailyPnl,
    dailyLossLimit: DAILY_LOSS_LIMIT,
    riskLimitPerTrade: RISK_LIMIT_PER_TRADE,
    recentClosedTrades: sortedTrades(state.trades),
    openPositions: state.positions.map((position) => ({
      position,
      holdingMs: now - position.openedAt,
    })),
    avgHoldingMs: avgHoldingMs(state.trades),
  };
}

/**
 * Zustand has no derivation graph, so firing once per transition is a hand-kept
 * key Set — that part is a genuine cost and the comparison should quote it.
 * Deciding *when* to re-evaluate is not: subscribeWithSelector watches the
 * three slices the rules actually read, so a quote for an instrument nobody
 * holds does not re-run a 250-trade sort.
 */
export function attachAlertEngine(
  store: ReturnType<typeof createAppStore>,
  options: { now(): number; onFire(alert: Alert): void },
): () => void {
  let firedKeys = new Set<string>();

  const evaluate = (state: AppState): void => {
    const alerts = evaluateAlerts(buildAlertContext(state, options.now()));
    const currentKeys = new Set(alerts.map(alertKey));

    for (const alert of alerts) {
      if (!firedKeys.has(alertKey(alert))) options.onFire(alert);
    }
    firedKeys = currentKeys;

    const previous = state.alerts;
    const changed =
      previous.length !== alerts.length ||
      previous.some((alert, index) => alertKey(alert) !== alertKey(alerts[index]!));
    if (changed) store.getState().setAlerts(alerts);
  };

  evaluate(store.getState());
  // Select the six held prices, not the `prices` object. The object is rebuilt
  // on every quote, so an identity comparison on it never short-circuits — the
  // earlier version of this guard fired on 100% of quotes while its comment
  // claimed otherwise.
  return store.subscribe(
    (state): readonly unknown[] => [state.positions, state.trades, ...selectHeldPrices(state)],
    () => { evaluate(store.getState()); },
    {
      equalityFn: (a, b) => a.length === b.length
        && a.every((value, index) => Object.is(value, b[index])),
    },
  );
}
