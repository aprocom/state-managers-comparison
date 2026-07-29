import { avgHoldingMs, evaluateAlerts, unrealizedPnl } from '@smc/domain';
import type { Alert, AlertContext } from '@smc/domain';
import type { AppState, createAppStore } from './store';

export const DAILY_LOSS_LIMIT = 400;
export const RISK_LIMIT_PER_TRADE = 100;

function alertKey(alert: Alert): string {
  return `${alert.kind}:${alert.subjectId}`;
}

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
    recentClosedTrades: [...state.trades].sort((a, b) => b.closedAt - a.closedAt),
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
  return store.subscribe(
    (state) => [state.prices, state.positions, state.trades] as const,
    () => { evaluate(store.getState()); },
    { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] },
  );
}
