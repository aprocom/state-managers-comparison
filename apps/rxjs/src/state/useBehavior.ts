import { useCallback, useSyncExternalStore } from 'react';
import type { BehaviorSubject } from 'rxjs';

/**
 * Bridges a BehaviorSubject to React. The subject is what makes this possible:
 * useSyncExternalStore needs a synchronous snapshot, and a bare Observable
 * cannot provide one. That bridge is RxJS's structural cost in a React app.
 */
export function useBehavior<T>(subject: BehaviorSubject<T>): T {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = subject.subscribe(() => onChange());
      return () => subscription.unsubscribe();
    },
    [subject],
  );
  return useSyncExternalStore(subscribe, () => subject.getValue(), () => subject.getValue());
}
