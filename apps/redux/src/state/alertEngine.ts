import type { Alert } from '@smc/domain';
import type { AppStore, RootState } from './slice';
import { selectAlerts } from './selectors';

function alertKey(alert: Alert): string {
  return `${alert.kind}:${alert.subjectId}`;
}

/**
 * RTK's listener middleware, which is the sanctioned place for this kind of
 * reactive side effect. Its `predicate` runs after every action but is handed
 * the previous and current state, so the engine re-evaluates only when one of
 * the three slices the rules actually read has changed — a quote for an
 * instrument nobody holds costs one reference comparison.
 *
 * What the middleware does not give us is the fire-once guarantee: it notifies
 * per action, not per transition of the derived alert set, so the key Set below
 * stays hand-maintained. That is the honest split, and it is the cost this
 * comparison is meant to expose.
 */
export function attachAlertEngine(
  store: AppStore,
  options: { now(): number; onFire(alert: Alert): void; onChange(alerts: Alert[]): void },
): () => void {
  let firedKeys = new Set<string>();
  let lastSignature = '';

  const evaluate = (): void => {
    const alerts = selectAlerts(store.getState(), options.now());
    const keys = new Set(alerts.map(alertKey));

    for (const alert of alerts) {
      if (!firedKeys.has(alertKey(alert))) options.onFire(alert);
    }
    firedKeys = keys;

    const signature = [...keys].sort().join('|');
    if (signature !== lastSignature) {
      lastSignature = signature;
      options.onChange(alerts);
    }
  };

  evaluate();
  return store.listeners.startListening({
    predicate: (_action, current, previous) => {
      const next = (current as RootState).app;
      const before = (previous as RootState).app;
      return next.prices !== before.prices
        || next.positions !== before.positions
        || next.trades !== before.trades;
    },
    effect: () => { evaluate(); },
  });
}
