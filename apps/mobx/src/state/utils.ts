import { alertKey } from '@smc/domain';
import type { Alert } from '@smc/domain';

/** A stable signature of the whole alert set, for the `reaction` to compare. */
export function alertKeys(alerts: Alert[]): string {
  return alerts.map(alertKey).sort().join('|');
}
