import type { Alert } from '@smc/domain';
import type { appStore } from './slice';
import { selectAlerts } from './selectors';

function alertKey(alert: Alert): string {
  return `${alert.kind}:${alert.subjectId}`;
}

/**
 * Redux offers a listener middleware for exactly this, but it fires per action
 * rather than per derived-state transition, so the fire-once guarantee still
 * needs a hand-maintained key set. Subscribing to the store is the simpler
 * expression of the same logic and is what is measured here.
 */
export function attachAlertEngine(
  store: typeof appStore,
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
  return store.subscribe(evaluate);
}
