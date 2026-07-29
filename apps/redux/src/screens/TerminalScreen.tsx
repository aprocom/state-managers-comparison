import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import type { Alert } from '@smc/domain';
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import { appStore, instrumentSelected, quoteApplied } from '../state/slice';
import type { AppDispatch, RootState } from '../state/slice';
import {
  selectAccountTotals, selectInstrumentRows, selectPositionRows,
} from '../state/selectors';
import { attachAlertEngine } from '../state/alertEngine';

export function TerminalScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const feedRate = useSelector((state: RootState) => state.app.feedRate);
  const selectedId = useSelector((state: RootState) => state.app.selectedInstrumentId);
  const instrumentRows = useSelector(selectInstrumentRows);
  const positionRows = useSelector(selectPositionRows);
  const totals = useSelector(selectAccountTotals);

  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(
    () => attachAlertEngine(appStore, {
      now: () => Date.now(),
      onFire: () => {},
      onChange: setAlerts,
    }),
    [],
  );

  useEffect(() => {
    const feed = createFeed({
      instruments: INSTRUMENTS,
      seed: 20260729,
      updatesPerSecond: feedRate,
      startPrices: START_PRICES,
    });
    const unsubscribe = feed.subscribe((quote) => dispatch(quoteApplied(quote)));
    feed.start();
    return () => {
      feed.stop();
      unsubscribe();
    };
  }, [feedRate, dispatch]);

  return (
    <div data-testid={TESTID.screenTerminal} className="terminal">
      <AlertList alerts={alerts} />
      <AccountSummary {...totals} />
      <PositionsPanel rows={positionRows} />
      <InstrumentTable
        rows={instrumentRows}
        selectedId={selectedId}
        onSelect={(id) => dispatch(instrumentSelected(id))}
      />
    </div>
  );
}
