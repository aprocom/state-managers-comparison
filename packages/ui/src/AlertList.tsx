import type { Alert } from '@smc/domain';
import { TESTID } from './testids';

/**
 * `alerts` is the current set — it must shrink when a rule stops triggering.
 * `firedCount` counts transitions *into* a triggered state, which is what the
 * five alert engines are actually being compared on. Keeping both on screen is
 * what makes the fire-once path observable end to end instead of only in unit
 * tests.
 */
export function AlertList({ alerts, firedCount }: { alerts: Alert[]; firedCount: number }) {
  return (
    <ul data-testid={TESTID.alertList} className="alerts">
      <li className="alerts__count">
        <span data-testid={TESTID.alertFiredCount}>{firedCount}</span>
        {' fired'}
      </li>
      {alerts.map((alert) => (
        <li
          key={`${alert.kind}:${alert.subjectId}`}
          data-testid={TESTID.alert(alert.kind, alert.subjectId)}
          data-alert-kind={alert.kind}
          className={`alert alert--${alert.kind}`}
        >
          {alert.message}
        </li>
      ))}
    </ul>
  );
}
