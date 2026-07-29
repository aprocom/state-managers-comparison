import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import type { Alert } from '@smc/domain';
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import { appStore, attachAlertEngine } from '../state/store';

export const TerminalScreen = observer(function TerminalScreen() {
  const [firedAlerts, setFiredAlerts] = useState<Alert[]>([]);

  useEffect(
    () => attachAlertEngine(appStore, () => { setFiredAlerts(appStore.alerts.slice()); }),
    [],
  );

  useEffect(() => {
    const feed = createFeed({
      instruments: INSTRUMENTS,
      seed: 20260729,
      updatesPerSecond: appStore.feedRate,
      startPrices: START_PRICES,
    });
    const unsubscribe = feed.subscribe((quote) => appStore.applyQuote(quote));
    feed.start();
    return () => {
      feed.stop();
      unsubscribe();
    };
  }, [appStore.feedRate]);

  return (
    <div data-testid={TESTID.screenTerminal} className="terminal">
      <AlertList alerts={firedAlerts} />
      <AccountSummary {...appStore.accountTotals} />
      <PositionsPanel rows={appStore.positionRows} />
      <InstrumentTable
        rows={appStore.instrumentRows}
        selectedId={appStore.selectedInstrumentId}
        onSelect={(id) => appStore.selectInstrument(id)}
      />
    </div>
  );
});
