import { createStore } from 'jotai';
import type { Alert } from '@smc/domain';
import { alertsAtom } from './atoms';
import { alertKey } from '@smc/domain';

export type AppStore = ReturnType<typeof createStore>;

export const appStore: AppStore = createStore();

/**
 * Jotai has no built-in "run this effect when a derived atom changes" for a
 * store outside React, so the engine subscribes to the derived atom and diffs
 * the fired keys by hand — the same bookkeeping Zustand needs. The derivation
 * itself is free; only the notification is not.
 */
export function attachAlertEngine(
  store: AppStore,
  onFire: (alert: Alert) => void,
): () => void {
  let firedKeys = new Set<string>();

  const evaluate = (): void => {
    const alerts = store.get(alertsAtom);
    const keys = new Set(alerts.map(alertKey));
    for (const alert of alerts) {
      if (!firedKeys.has(alertKey(alert))) onFire(alert);
    }
    firedKeys = keys;
  };

  evaluate();
  return store.sub(alertsAtom, evaluate);
}
