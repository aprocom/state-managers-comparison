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
 * Zustand has no derivation graph, so the engine re-evaluates on every store
 * change and diffs the result against the previously fired keys by hand. The
 * bookkeeping below is exactly the cost this comparison is meant to expose —
 * MobX and Jotai express the same behaviour declaratively.
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
  return store.subscribe(evaluate);
}
