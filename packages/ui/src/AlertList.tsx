import type { Alert } from '@smc/domain';
import { TESTID } from './testids';

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <ul data-testid={TESTID.alertList} className="alerts">
      {alerts.map((alert) => (
        <li
          key={`${alert.kind}:${alert.subjectId}`}
          data-testid={TESTID.alert(alert.kind)}
          className={`alert alert--${alert.kind}`}
        >
          {alert.message}
        </li>
      ))}
    </ul>
  );
}
