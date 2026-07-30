import type { Alert } from '@smc/domain';
import type { AppStore, RootState } from './slice';
import { selectAlerts, selectHeldInstrumentIds } from './selectors';
import { alertKey } from '@smc/domain';

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
    // Compare the held prices, not the `prices` object: Immer produces a new
    // object on every quote, so an identity check on it never short-circuits.
    // The earlier version of this predicate returned true for 100% of quotes
    // while its comment claimed it filtered them.
    predicate: (_action, current, previous) => {
      const next = (current as RootState).app;
      const before = (previous as RootState).app;
      if (next.positions !== before.positions || next.trades !== before.trades) return true;
      return selectHeldInstrumentIds(current as RootState)
        .some((id) => next.prices[id] !== before.prices[id]);
    },
    effect: () => { evaluate(); },
  });
}
